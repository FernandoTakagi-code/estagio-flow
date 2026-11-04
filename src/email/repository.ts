import { prisma } from '../lib/prisma.js';
import type { Transaction } from '../lib/transaction.js';
import type { Prisma, MensagemEmail } from '../generated/prisma/client.js';
export const enqueue = (tx: Transaction, data: Prisma.MensagemEmailUncheckedCreateInput) => tx.mensagemEmail.create({ data });
export async function claim() {
  const rows = await prisma.$queryRaw<MensagemEmail[]>`
    UPDATE mensagem_email SET estado = 'enviando', tentativas = tentativas + 1, trava_em = now()
    WHERE id = (SELECT id FROM mensagem_email WHERE (estado = 'pendente' AND disponivel_em <= now())
      OR (estado = 'enviando' AND trava_em < now() - interval '2 minutes') ORDER BY criado_em FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id, usuario_id AS "usuarioId", tipo, referencia_hash AS "referenciaHash", conteudo_cifrado AS "conteudoCifrado", estado, tentativas, criado_em AS "criadoEm", disponivel_em AS "disponivelEm", trava_em AS "travaEm", expira_em AS "expiraEm", codigo_erro AS "codigoErro"`;
  return rows[0];
}
export const user = (id: string) => prisma.usuario.findUnique({ where: { id }, select: { ativo: true, senhaHash: true } });
export const invite = (hash: string) => prisma.conviteUsuario.findUnique({ where: { tokenHash: hash } });
export const reset = (hash: string) => prisma.recuperacaoSenha.findUnique({ where: { tokenHash: hash } });
export const finish = (id: string, tentativas: number, data: Prisma.MensagemEmailUpdateManyMutationInput) => prisma.mensagemEmail.updateMany({ where: { id, estado: 'enviando', tentativas }, data });
