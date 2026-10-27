import { prisma } from '../src/lib/prisma.js';
import { Prisma } from '../src/generated/prisma/client.js';

try {
  const result = await prisma.importacaoAlunos.updateMany({
    where: { expiraEm: { lte: new Date() }, confirmadaEm: null, NOT: { dados: { equals: Prisma.DbNull } } },
    data: { dados: Prisma.DbNull },
  });
  console.log(`Dados removidos de ${result.count} prévias expiradas. Os metadados foram preservados.`);
} catch {
  console.error('Não foi possível limpar as prévias. Confira a conexão e as migrations.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
