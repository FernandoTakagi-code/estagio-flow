import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { Modal } from '../components/ui/modal';
import { Button } from '../components/ui/button';
import { Feedback, InvitationList, useOperation } from './shared';
import type { Invitation } from './types';

interface Preview { id: string | null; podeConfirmar: boolean; expiraEm: string | null; quantidade: number; alunos: { linha: number; nome: string; email: string; erros: string[] }[] }
export function ImportStudents({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const operation = useOperation();
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [reading, setReading] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  return <Modal title="Importar alunos" description="Confira os dados antes de criar as contas. Até 100 alunos por arquivo." onClose={() => { if (!operation.busy && !reading) onClose(); }}><Feedback error={operation.error} />
    {invitations.length ? <><p className="notice" role="status">{invitations.length} alunos cadastrados. Agora você pode matriculá-los em Pessoas.</p><InvitationList invitations={invitations} /></> : <>
      <p className="muted">Use CSV em UTF-8, com as colunas nome e email, separadas por vírgula ou ponto e vírgula. Não inclua senhas.</p><pre className="csv-example">{'nome;email\nPessoa Exemplo;pessoa@example.test'}</pre>
      <label className="coord-file">Arquivo CSV<input type="file" accept=".csv,text/csv" disabled={operation.busy || reading} onChange={async (event) => {
        const file = event.target.files?.[0]; setPreview(null); setCsv(''); setFileName(''); operation.setError(''); setUncertain(false);
        if (!file) return;
        event.target.value = '';
        if (file.size > 65536) { operation.setError('O arquivo deve ter no máximo 64 KB.'); event.target.value = ''; return; }
        setReading(true);
        try {
          const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); setCsv(text); setFileName(file.name);
        } catch { operation.setError('Não foi possível ler o arquivo. Salve-o como CSV UTF-8 e tente novamente.'); } finally { setReading(false); }
      }} /></label>
      <Button disabled={!csv || operation.busy || reading} onClick={() => void operation.run(async () => { setPreview(null); setUncertain(false); setPreview(await api<Preview>('/usuarios/importacoes/previa', { method: 'POST', csv })); })}>{operation.busy ? 'Processando…' : reading ? 'Lendo arquivo…' : 'Gerar prévia'}</Button>
      {preview && <section className="coord-detail-section"><h3>Prévia · {preview.quantidade} alunos</h3><p className="field-hint">{fileName}{preview.expiraEm ? ` · Válida até ${new Date(preview.expiraEm).toLocaleTimeString('pt-BR')}` : ''}</p><div className="import-preview">{preview.alunos.map((row) => <article className="import-preview-row" key={row.linha}><span className="muted">Linha {row.linha}</span><div><strong>{row.nome || 'Nome não informado'}</strong><p>{row.email || 'E-mail não informado'}</p>{row.erros.map((error) => <p key={error} className="attention-text">{error}</p>)}</div><span className={row.erros.length ? 'attention-text' : 'success-text'}>{row.erros.length ? 'Corrigir' : 'Pronto'}</span></article>)}</div>
        {preview.podeConfirmar ? <><p className="field-hint">A confirmação cria todas as contas e convites. Não matricula os alunos automaticamente.</p><Button disabled={operation.busy || uncertain || !preview.id} onClick={() => void operation.run(async () => {
          if (!preview.id) return;
          if (preview.expiraEm && new Date(preview.expiraEm) <= new Date()) { setPreview(null); throw new Error('A prévia expirou. Gere outra antes de confirmar.'); }
          try {
            const result = await api<{ alunos: Invitation[] }>(`/usuarios/importacoes/${preview.id}/confirmar`, { method: 'POST', body: { confirmar: true } }); setInvitations(result.alunos); setPreview(null); setCsv(''); onChanged();
          } catch (cause) {
            if (cause instanceof ApiError && cause.status === 0) { setUncertain(true); onChanged(); throw new Error('A conexão caiu. Confira Pessoas antes de tentar novamente: as contas podem ter sido criadas. Se necessário, gere novos convites nos detalhes das contas.'); }
            if (cause instanceof ApiError && [404, 409, 410].includes(cause.status)) setPreview(null);
            throw cause;
          }
        })}>{operation.busy ? 'Criando contas…' : `Confirmar importação de ${preview.quantidade} alunos`}</Button></> : <p className="notice">Corrija as linhas indicadas no arquivo e selecione-o novamente. Nenhuma conta foi criada.</p>}
      </section>}
    </>}
  </Modal>;
}
