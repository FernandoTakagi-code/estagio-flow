import { startTestDatabase } from './database.js';
import { randomBytes } from 'node:crypto';
import type { Actor } from '../../src/auth/service.js';

// This helper always starts its own in-memory PostgreSQL before importing the app.
const demoPort = Number(process.env.DEMO_API_PORT ?? 3101);
const databasePort = Number(process.env.DEMO_DATABASE_PORT ?? 55443);
if (![demoPort, databasePort].every((port) => Number.isInteger(port) && port >= 1024 && port <= 65535)) throw new Error('Portas de demonstração inválidas.');
const context = await startTestDatabase(databasePort);
process.env.EMAIL_MODE = 'capture';
process.env.EMAIL_ENCRYPTION_KEY = randomBytes(32).toString('hex');
process.env.PUBLIC_APP_URL = process.env.DEMO_APP_URL ?? 'http://127.0.0.1:5173';
process.env.DEMO_EMAIL_INBOX = 'true';
process.env.LEGAL_DEMO_MODE = 'true';
if (new URL(process.env.DATABASE_URL!).hostname !== '127.0.0.1') throw new Error('Somente banco temporário local.');
const db = context.prisma;
const institution = await db.instituicao.create({ data: { nome: 'Escola Fictícia' } });
const coordinator = await context.createCoordinator({ nome: 'Coordenação Fictícia', email: 'coord@example.test', instituicaoId: institution.id, senha: 'SenhaFicticiaParaTeste2026!' });
const saved = await db.usuario.findUniqueOrThrow({ where: { id: coordinator.id } });
const student = await db.usuario.create({ data: { instituicaoId: institution.id, nome: 'Ana Silva', email: 'aluno@example.test', perfil: 'aluno', senhaHash: saved.senhaHash } });
const teacher = await db.usuario.create({ data: { instituicaoId: institution.id, nome: 'Professora Fictícia', email: 'prof@example.test', perfil: 'professora', senhaHash: saved.senhaHash, coren: 'COREN-FICTICIO' } });
const turma = await db.turma.create({ data: { instituicaoId: institution.id, codigo: 'ENF-01' } });
const field = await db.campoEstagio.create({ data: { instituicaoId: institution.id, nome: 'Hospital de Ensino' } });
const enrollment = await db.matriculaTurma.create({ data: { instituicaoId: institution.id, turmaId: turma.id, alunoId: student.id, criadoPorId: coordinator.id, iniciadoEm: new Date('2020-01-01T12:00:00Z') } });
let firstLink = '';
for (const [index, [nome, cargaHorariaTotal]] of ([['Fundamentos de Enfermagem', 90], ['Saúde Coletiva', 30], ['Saúde Mental', 30], ['Clínica Médica', 80], ['Clínica Cirúrgica', 80], ['Terceira Idade', 30], ['Saúde da Mulher', 50], ['Saúde da Criança', 50], ['Emergência', 60], ['Pacientes Críticos', 100]] as const).entries()) {
  const discipline = await db.disciplina.create({ data: { instituicaoId: institution.id, codigo: `DISC-${index.toString().padStart(2, '0')}`, nome, cargaHorariaTotal } });
  const stage = await db.estagio.create({ data: { instituicaoId: institution.id, codigo: `GRUPO-${index}`, turmaId: turma.id, disciplinaId: discipline.id, campoEstagioId: field.id, professoraId: teacher.id, criadoPorId: coordinator.id } });
  const link = await db.vinculoEstagio.create({ data: { instituicaoId: institution.id, estagioId: stage.id, matriculaId: enrollment.id, turmaId: turma.id, disciplinaId: discipline.id, alunoId: student.id, criadoPorId: coordinator.id, iniciadoEm: new Date('2020-01-01T12:00:00Z') } });
  if (index === 0) firstLink = link.id;
}
const beginner = await db.usuario.create({ data: { instituicaoId: institution.id, nome: 'Bruno Exemplo', email: 'iniciante@example.test', perfil: 'aluno', senhaHash: saved.senhaHash } });
const beginnerEnrollment = await db.matriculaTurma.create({ data: { instituicaoId: institution.id, turmaId: turma.id, alunoId: beginner.id, criadoPorId: coordinator.id, iniciadoEm: new Date('2020-01-01T12:00:00Z') } });
const first = await db.vinculoEstagio.findUniqueOrThrow({ where: { id: firstLink } });
await db.vinculoEstagio.create({ data: { instituicaoId: institution.id, estagioId: first.estagioId, matriculaId: beginnerEnrollment.id, turmaId: turma.id, disciplinaId: first.disciplinaId, alunoId: beginner.id, criadoPorId: coordinator.id, iniciadoEm: new Date('2020-01-01T12:00:00Z') } });
const { createRecord, changeRecord } = await import('../../src/registros/service.js');
const { approveRecords } = await import('../../src/registros/approval-service.js');
for (const [data, atividades, status, horaFim] of [
  ['2026-10-21', 'Organização de materiais', 'aprovado', '13:00'],
  ['2026-10-22', 'Cuidados de enfermagem', 'aprovado', '13:00'],
  ['2026-10-23', 'Práticas de biossegurança', 'devolvido', '11:00'],
  ['2026-10-26', 'Aferição de sinais vitais', 'enviado', '13:00'],
] as const) {
  const draft = await createRecord(student as Actor, { vinculoId: firstLink, data, horaInicio: '07:00', horaFim, atividades });
  const sent = await changeRecord(student as Actor, draft.id, draft.versao, 'enviar');
  if (status === 'aprovado') await approveRecords(teacher as Actor, { registros: [{ id: sent.id, versao: sent.versao }] });
  if (status === 'devolvido') await changeRecord(teacher as Actor, sent.id, sent.versao, 'devolver', undefined, 'Detalhe as atividades realizadas.');
}
const agenda = await import('../../src/agenda/service.js');
await agenda.create(coordinator as Actor, { estagioId: first.estagioId, data: '2026-11-02', horaInicio: '07:00', horaFim: '13:00' });
await agenda.create(coordinator as Actor, { estagioId: first.estagioId, data: '2026-11-04', horaInicio: '07:00', horaFim: '13:00' });
// Completed fictional example, alongside Ana's pending records and Bruno's empty sheet.
const completedStudent = await db.usuario.create({ data: { instituicaoId: institution.id, nome: 'Carla Demonstração', email: 'concluido@example.test', perfil: 'aluno', senhaHash: saved.senhaHash } });
const completedEnrollment = await db.matriculaTurma.create({ data: { instituicaoId: institution.id, turmaId: turma.id, alunoId: completedStudent.id, criadoPorId: coordinator.id, iniciadoEm: new Date('2020-01-01T12:00:00Z') } });
const completedLink = await db.vinculoEstagio.create({ data: { instituicaoId: institution.id, estagioId: first.estagioId, matriculaId: completedEnrollment.id, turmaId: turma.id, disciplinaId: first.disciplinaId, alunoId: completedStudent.id, criadoPorId: coordinator.id, iniciadoEm: new Date('2020-01-01T12:00:00Z') } });
const session = await agenda.create(coordinator as Actor, { estagioId: first.estagioId, data: '2026-11-05', horaInicio: '07:00', horaFim: '13:00' });
await agenda.mark(teacher as Actor, session.id, { vinculoId: completedLink.id, versao: 0, situacao: 'presente' });
const activity = await createRecord(completedStudent as Actor, { vinculoId: completedLink.id, sessaoId: session.id, data: '2026-11-05', horaInicio: '07:00', horaFim: '13:00', atividades: 'Atividade fictícia supervisionada, sem dados de pacientes.' });
const sent = await changeRecord(completedStudent as Actor, activity.id, activity.versao, 'enviar');
await approveRecords(teacher as Actor, { registros: [{ id: sent.id, versao: sent.versao }] });
const assessment = await import('../../src/avaliacao/service.js');
await assessment.publish(teacher as Actor, activity.fichaId, { notas: ['8', '9', '8.5', '8', '9', '8', '9', '8', '9'], versaoAnterior: 0, confirmar: true });
const closure = await import('../../src/registros/closure-service.js');
const summary = await closure.sheetDetail(teacher as Actor, activity.fichaId);
await closure.closeSheet(teacher as Actor, activity.fichaId, summary.revisao);
const server = context.createApp().listen(demoPort, '127.0.0.1', () => console.log(`API de teste local: http://127.0.0.1:${demoPort}. Dados fictícios em memória; Supabase não é utilizado.`));
const { startEmailWorker } = await import('../../src/email/service.js');
const stopEmails = startEmailWorker(500);
async function shutdown() { stopEmails(); server.close(); await db.$disconnect(); await context.socket.stop(); await context.database.close(); process.exit(0); }
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
