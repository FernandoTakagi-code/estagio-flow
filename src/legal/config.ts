import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { localCapture } from '../email/config.js';
const document = z.object({ versao: z.string().min(1).max(100), titulo: z.string().min(3).max(200), texto: z.string().min(80).max(30000) }).strict();
const configSchema = z.object({ revisadoPelaInstituicao: z.boolean(), controlador: z.string().min(3), contato: z.email(), termos: document, privacidade: document }).strict();
const drafts = {
  termos: { versao: 'rascunho-1', titulo: 'Termos de Uso — rascunho', texto: 'Este é um rascunho para revisão da instituição. O Estágio Flow organiza os registros de estágio, frequência e acompanhamento de horas. Cada pessoa deve utilizar sua própria conta e proteger sua senha. As informações registradas devem corresponder às atividades realizadas. Não inclua nomes de pacientes, prontuários, diagnósticos ou outros dados que identifiquem pacientes. Regras de uso, responsabilidades, correções, atendimento e encerramento do acesso precisam ser confirmadas pela instituição antes da publicação deste documento.' },
  privacidade: { versao: 'rascunho-1', titulo: 'Aviso de Privacidade — rascunho', texto: 'Este é um rascunho para revisão da instituição. O sistema trata nome, e-mail, perfil, vínculos acadêmicos, frequência, atividades e histórico de aprovações para apoiar a gestão do estágio. Senhas são armazenadas como hash; links de acesso são pessoais. Os perfis limitam o acesso de alunos, professoras e coordenação. A instituição precisa definir o controlador, contato para exercício de direitos, finalidades e bases legais, prazos de retenção, destinatários, fornecedores e eventual transferência internacional. Também deve confirmar o atendimento a menores de idade e o procedimento para incidentes. Não registre dados identificáveis de pacientes. Ciência deste aviso não equivale a consentimento genérico para qualquer uso de dados.' },
};
export function legalConfig() {
  const demo = process.env.LEGAL_DEMO_MODE === 'true';
  if (demo && !localCapture()) throw new Error('Documentos de demonstração exigem banco local descartável.');
  const file = process.env.LEGAL_CONFIG_PATH;
  const configured = file ? configSchema.parse(JSON.parse(readFileSync(file, 'utf8'))) : null;
  const published = Boolean(configured?.revisadoPelaInstituicao);
  if (process.env.NODE_ENV === 'production' && !published) throw new Error('Revise e configure os documentos institucionais antes da produção.');
  if (process.env.NODE_ENV === 'production' && configured?.contato.endsWith('.test')) throw new Error('Configure o contato institucional de privacidade.');
  const source = demo ? { termos: { ...drafts.termos, versao: 'demo-termos-1', titulo: 'Termos de Uso de demonstração', texto: 'SIMULAÇÃO SEM EFEITO CONTRATUAL. Usada somente com contas fictícias em banco descartável.\n\n' + drafts.termos.texto }, privacidade: { ...drafts.privacidade, versao: 'demo-privacidade-1', titulo: 'Aviso de Privacidade de demonstração', texto: 'SIMULAÇÃO SEM DADOS REAIS. Estes documentos não são uma política institucional aprovada.\n\n' + drafts.privacidade.texto } } : configured ?? drafts;
  const documents = (['termos', 'privacidade'] as const).map((tipo) => { const value = source[tipo]; const hash = createHash('sha256').update(JSON.stringify({ tipo, ...value, controlador: configured?.controlador ?? null, contato: configured?.contato ?? null })).digest('hex'); return { tipo, ...value, hash }; });
  return { exigido: demo || published, demonstracao: demo, estado: demo ? 'demonstracao' : published ? 'publicado' : 'rascunho', controlador: configured?.controlador ?? null, contato: configured?.contato ?? null, documentos: documents };
}
export type LegalConfig = ReturnType<typeof legalConfig>;
