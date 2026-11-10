import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { User } from '../lib/types';
import { dateLabel, errorMessage, hours } from '../lib/utils';
import { Modal } from './ui/modal';
import { Button } from './ui/button';
import './sheet-detail.css';

interface Summary {
  id: string; aluno: { nome: string }; disciplina: { nome: string; cargaHorariaTotal: number };
  turma: string; local: string; totalMinutos: number; pendentes: number; dataUltimoDia: string | null; revisao: string;
  fechamento: { criadoEm: string; coren: string; totalMinutos: number; dataUltimoDia: string } | null;
}
export function SheetDetail({ id, user, onClose, onChanged }: { id: string; user: User; onClose: () => void; onChanged: () => void }) {
  const [sheet, setSheet] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState('');
  async function load(signal?: AbortSignal) {
    const result = await api<{ ficha: Summary }>(`/frequencia/fichas/${id}`, { signal });
    setSheet(result.ficha); setConfirmed(false);
  }
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).catch((cause: unknown) => { if (!controller.signal.aborted) setError(errorMessage(cause)); });
    return () => controller.abort();
  }, [id]);
  async function closeSheet() {
    if (!sheet || !confirmed || busy) return;
    setBusy(true); setError('');
    try {
      await api(`/frequencia/fichas/${id}/fechar`, { method: 'POST', body: { revisao: sheet.revisao, confirmar: true } });
      onChanged(); await load(); setNotice('Ficha fechada. O histórico foi preservado.');
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) { await load().catch(() => undefined); onChanged(); }
      setError(errorMessage(cause));
    } finally { setBusy(false); }
  }
  return <Modal title="Fechamento da ficha" description="Consulte as horas e o fechamento deste vínculo de estágio." onClose={() => { if (!busy) onClose(); }}>
    {error && <p role="alert" className="form-error">{error}<Button variant="ghost" disabled={busy} onClick={() => { setError(''); void load().catch((cause: unknown) => setError(errorMessage(cause))); }}>Atualizar resumo</Button></p>}
    {notice && <p role="status" className="notice">{notice}</p>}
    {!sheet ? <p role="status">Carregando ficha…</p> : <>
      <div className="readonly-record"><h3>{sheet.aluno.nome}</h3><p>{sheet.disciplina.nome} · {sheet.turma}</p><p>{sheet.local}</p>
        <p><strong>Horas aprovadas neste vínculo:</strong> {hours(sheet.totalMinutos)}</p>
        <p>Carga exigida na disciplina: {sheet.disciplina.cargaHorariaTotal}h</p>
        <p>Registros pendentes: {sheet.pendentes}</p>
        <p>Último dia aprovado: {sheet.dataUltimoDia ? dateLabel(sheet.dataUltimoDia) : 'Sem registros aprovados'}</p>
      </div>
      {sheet.fechamento ? <section className="notice"><h3>Ficha fechada</h3><p>COREN: {sheet.fechamento.coren}</p><p>Confirmado em {new Date(sheet.fechamento.criadoEm).toLocaleString('pt-BR')}</p><p>Os registros desta ficha estão bloqueados para alterações.</p></section> : <>
        <p className="field-hint">Este fechamento reúne somente as horas deste vínculo. Outros vínculos continuam compondo o total da disciplina. Fechar esta ficha não declara a conclusão da disciplina inteira.</p>
        {user.perfil === 'professora' && <div className="record-form">
          {!user.coren && <p className="form-error">É necessário cadastrar seu COREN antes de fechar.</p>}
          {sheet.pendentes > 0 && <p className="form-error">Resolva rascunhos, enviados e devolvidos antes de fechar.</p>}
          <p>Após confirmar, esta ficha não aceitará novos registros nem reabertura de aprovações.</p>
          <label className="closure-confirmation"><input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} /><span>Confirmo as horas deste vínculo como preceptora e RT, com meu COREN cadastrado.</span></label>
          <Button disabled={busy || !confirmed || !user.coren || sheet.pendentes > 0 || sheet.totalMinutos === 0} onClick={() => void closeSheet()}>{busy ? 'Fechando…' : 'Fechar ficha definitivamente'}</Button>
        </div>}
      </>}
    </>}
  </Modal>;
}
