import { prisma } from '../src/lib/prisma.js';

const instituicaoId = '00000000-0000-4000-8000-000000000001';

try {
  await prisma.$transaction(async (tx) => {
    await tx.instituicao.upsert({
      where: { id: instituicaoId },
      update: {},
      create: {
        id: instituicaoId,
        nome: 'Escola Técnica de Enfermagem Demonstração',
      },
    });

    await tx.turma.upsert({
      where: {
        instituicaoId_codigo: { instituicaoId, codigo: 'ENF-DEMO-01' },
      },
      update: {},
      create: { instituicaoId, codigo: 'ENF-DEMO-01' },
    });
  });

  console.log('Seed concluído: instituição e turma fictícias disponíveis.');
} catch {
  console.error('Não foi possível executar o seed. Confira a conexão e as migrations.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
