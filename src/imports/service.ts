import { parse } from 'csv-parse/sync';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { createUserSchema } from '../auth/schemas.js';
import { prepareInvite, type Actor } from '../auth/service.js';

const maxRows = 100;
const maxBytes = 64 * 1024;
const storedRowsSchema = z.array(z.strictObject({
  nome: z.string().min(2).max(200),
  email: z.email().max(254),
})).min(1).max(maxRows);
type CsvRow = { record: string[]; info: { lines: number } };
type ImportRow = { linha: number; nome: string; email: string; erros: string[] };

function readCsv(csv: unknown): ImportRow[] {
  if (typeof csv !== 'string' || !csv.trim()) throw new HttpError(400, 'Envie um arquivo CSV em UTF-8 com Content-Type text/csv.');
  if (Buffer.byteLength(csv, 'utf8') > maxBytes) throw new HttpError(413, 'CSV excede o limite de 64 KB.');
  const headerLine = csv.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/).find((line) => line.trim()) ?? '';
  const delimiter = headerLine.includes(';') ? ';' : ',';
  let records: CsvRow[];
  try {
    // With info enabled the parser returns records with metadata instead of arrays.
    records = parse(csv, { bom: true, delimiter, trim: true, skip_empty_lines: true, info: true, max_record_size: 2048 }) as unknown as CsvRow[];
  } catch {
    throw new HttpError(400, 'CSV inválido. Confira aspas, separadores e quantidade de colunas.');
  }
  const header = records.shift()?.record.map((value) => value.trim().toLowerCase());
  if (!header || header.length !== 2 || !header.includes('nome') || !header.includes('email')) {
    throw new HttpError(400, 'O cabeçalho deve conter somente nome e email. O perfil é sempre aluno.');
  }
  if (records.length === 0 || records.length > maxRows) throw new HttpError(400, 'Cada importação deve conter de 1 a 100 alunos.');
  return records.map(({ record, info }) => {
    const nome = record[header.indexOf('nome')] ?? '';
    const email = record[header.indexOf('email')]?.trim().toLowerCase() ?? '';
    const result = createUserSchema.safeParse({ nome, email, perfil: 'aluno' });
    const erros = result.success ? [] : [...new Set(result.error.issues.map((issue) => issue.path[0] === 'nome'
      ? 'Nome deve conter de 2 a 200 caracteres.' : 'E-mail inválido ou maior que 254 caracteres.'))];
    return { linha: info.lines, nome: result.success ? result.data.nome : nome.trim(), email, erros };
  });
}

export async function previewImport(actor: Actor, csv: unknown) {
  const rows = readCsv(csv);
  const frequency = new Map<string, number>();
  for (const row of rows) frequency.set(row.email, (frequency.get(row.email) ?? 0) + 1);
  const existing = await prisma.usuario.findMany({
    where: { email: { in: rows.map((row) => row.email) } }, select: { email: true },
  });
  const used = new Set(existing.map((user) => user.email));
  for (const row of rows) {
    if ((frequency.get(row.email) ?? 0) > 1) row.erros.push('E-mail repetido no arquivo.');
    if (used.has(row.email)) row.erros.push('E-mail indisponível para cadastro.');
  }
  const valid = rows.every((row) => row.erros.length === 0);
  if (!valid) return { podeConfirmar: false, id: null, expiraEm: null, quantidade: rows.length, alunos: rows };

  const now = new Date();
  const expiraEm = new Date(now.getTime() + 30 * 60 * 1000);
  const preview = await prisma.$transaction(async (tx) => {
    // Remove expired personal data from this coordinator's previous previews.
    await tx.importacaoAlunos.updateMany({
      where: { instituicaoId: actor.instituicaoId, criadoPorId: actor.id, expiraEm: { lte: now }, confirmadaEm: null },
      data: { dados: Prisma.DbNull },
    });
    return tx.importacaoAlunos.create({
      data: {
        instituicaoId: actor.instituicaoId, criadoPorId: actor.id, quantidade: rows.length, expiraEm,
        dados: rows.map(({ nome, email }) => ({ nome, email })),
      },
      select: { id: true },
    });
  });
  return { podeConfirmar: true, id: preview.id, expiraEm, quantidade: rows.length, alunos: rows };
}

export async function confirmImport(actor: Actor, id: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const preview = await tx.importacaoAlunos.findFirst({
        where: { id, instituicaoId: actor.instituicaoId, criadoPorId: actor.id },
      });
      if (!preview) throw new HttpError(404, 'Prévia não encontrada.');
      if (preview.confirmadaEm) throw new HttpError(409, 'Esta importação já foi confirmada.');
      if (preview.expiraEm <= new Date()) throw new HttpError(410, 'Prévia expirada. Envie o CSV novamente.');
      const rows = storedRowsSchema.parse(preview.dados);
      const claimed = await tx.importacaoAlunos.updateMany({
        where: { id, instituicaoId: actor.instituicaoId, criadoPorId: actor.id, confirmadaEm: null, expiraEm: { gt: new Date() } },
        data: { confirmadaEm: new Date(), dados: Prisma.DbNull },
      });
      if (claimed.count !== 1) throw new HttpError(409, 'Prévia indisponível. Gere outra prévia.');

      const users = rows.map((row) => {
        const input = createUserSchema.parse({ ...row, perfil: 'aluno' });
        return { id: randomUUID(), nome: input.nome, email: input.email, perfil: 'aluno' as const, instituicaoId: actor.instituicaoId, criadoPorId: actor.id };
      });
      const invitations = users.map((user) => prepareInvite(user.id, actor.id));
      await tx.usuario.createMany({ data: users });
      await tx.conviteUsuario.createMany({ data: invitations.map((invite) => invite.data) });
      return {
        importacaoId: id, quantidade: users.length,
        alunos: users.map((user, index) => ({ id: user.id, nome: user.nome, email: user.email, perfil: user.perfil, convite: invitations[index]!.publico })),
      };
    }, { timeout: 15_000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'Um e-mail passou a estar indisponível após a prévia. Nenhum aluno foi importado; gere outra prévia.');
    }
    throw error;
  }
}
