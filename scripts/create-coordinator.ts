import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { ZodError } from 'zod';
import { Prisma } from '../src/generated/prisma/client.js';
import { prisma } from '../src/lib/prisma.js';
import { HttpError } from '../src/lib/errors.js';
import { adminSchema } from '../src/auth/schemas.js';
import { createCoordinator } from '../src/auth/service.js';

async function readPassword(label: string) {
  if (!process.stdin.isTTY) throw new HttpError(400, 'Use um terminal interativo para digitar a senha.');
  const silentOutput = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const hidden = createInterface({ input: process.stdin, output: silentOutput, terminal: true });
  process.stdout.write(label);
  try { return await hidden.question(''); }
  finally { hidden.close(); process.stdout.write('\n'); }
}

try {
  const input = createInterface({ input: process.stdin, output: process.stdout });
  let nome: string, email: string, instituicaoId: string;
  try {
    nome = await input.question('Nome da coordenação: ');
    email = await input.question('E-mail: ');
    instituicaoId = await input.question('ID da instituição: ');
  } finally { input.close(); }
  const cadastro = adminSchema.omit({ senha: true }).parse({ nome, email, instituicaoId });
  const instituicao = await prisma.instituicao.findUnique({ where: { id: cadastro.instituicaoId }, select: { id: true } });
  if (!instituicao) throw new HttpError(404, 'Instituição não encontrada. Confira o UUID informado.');
  const senha = await readPassword('Senha (mínimo 12 caracteres, digitação oculta): ');
  const confirmacao = await readPassword('Confirme a senha: ');
  if (senha !== confirmacao) throw new HttpError(400, 'As senhas não coincidem.');
  const data = adminSchema.parse({ ...cadastro, senha });
  const user = await createCoordinator(data);
  console.log(`Conta de coordenação criada. ID: ${user.id}`);
} catch (error) {
  if (error instanceof ZodError) {
    const orientacoes: Record<string, string> = {
      nome: 'Nome: informe de 2 a 200 caracteres.',
      email: 'E-mail: informe um endereço válido, com até 254 caracteres.',
      instituicaoId: 'ID da instituição: informe o UUID completo, não um número. Exemplo da demonstração: 00000000-0000-4000-8000-000000000001.',
      senha: 'Senha: use de 12 a 128 caracteres.',
    };
    for (const campo of new Set(error.issues.map((issue) => String(issue.path[0])))) {
      console.error(orientacoes[campo] ?? 'Confira os campos informados.');
    }
  } else if (error instanceof HttpError) {
    console.error(error.message);
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    console.error('Já existe uma conta com esse e-mail. Nenhuma senha foi alterada.');
  } else {
    console.error('Não foi possível criar a coordenação. Confira a conexão com o banco e as migrations.');
  }
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
