import { prisma } from '../src/lib/prisma.js';

const instituicaoId = '00000000-0000-4000-8000-000000000001';
const disciplinas = [
  { codigo: 'FUNDAMENTOS', nome: 'Fundamentos de Enfermagem', cargaHorariaTotal: 90 },
  { codigo: 'SAUDE-COLETIVA', nome: 'Saúde Coletiva', cargaHorariaTotal: 30 },
  { codigo: 'SAUDE-MENTAL', nome: 'Saúde Mental', cargaHorariaTotal: 30 },
  { codigo: 'CLINICA-MEDICA', nome: 'Enfermagem em Clínica Médica', cargaHorariaTotal: 80 },
  { codigo: 'CLINICA-CIRURGICA', nome: 'Enfermagem em Clínica Cirúrgica', cargaHorariaTotal: 80 },
  { codigo: 'TERCEIRA-IDADE', nome: 'Enfermagem na Terceira Idade', cargaHorariaTotal: 30 },
  { codigo: 'SAUDE-MULHER', nome: 'Saúde da Mulher', cargaHorariaTotal: 50 },
  { codigo: 'SAUDE-CRIANCA', nome: 'Saúde da Criança e Adolescente', cargaHorariaTotal: 50 },
  { codigo: 'EMERGENCIA', nome: 'Enfermagem em Emergência', cargaHorariaTotal: 60 },
  { codigo: 'PACIENTES-CRITICOS', nome: 'Enfermagem em Pacientes Críticos', cargaHorariaTotal: 100 },
];

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
    for (const disciplina of disciplinas) {
      await tx.disciplina.upsert({
        where: { instituicaoId_codigo: { instituicaoId, codigo: disciplina.codigo } },
        update: {},
        create: { ...disciplina, instituicaoId },
      });
    }
  });

  console.log('Seed concluído: instituição, turma e dez disciplinas de demonstração disponíveis.');
} catch {
  console.error('Não foi possível executar o seed. Confira a conexão e as migrations.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
