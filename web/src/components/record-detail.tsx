import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import type { Approval, RecordEvent, RecordItem, User } from '../lib/types';
import { errorMessage, hours, today } from '../lib/utils';
import { Modal } from './ui/modal';
import { Button } from './ui/button';
import { StatusLabel } from './records';

const eventLabels: Record<string, string> = { criado: 'Rascunho criado', editado: 'Registro corrigido', enviado: 'Enviado para avaliação', devolvido: 'Devolvido pela professora', aprovado: 'Aprovado', reaberto: 'Reaberto pela professora', cancelado: 'Cancelado' };
export function RecordDetail({ initial, user, onClose, onChanged }: { initial: RecordItem; user: User; onClose: () => void; onChanged: () => void }) {
  const [record, setRecord] = useState(initial);
  const [events, setEvents] = useState<RecordEvent[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [eventPage, setEventPage] = useState(1);
  const [moreEvents, setMoreEvents] = useState(false);
  const [approvalPage, setApprovalPage] = useState(1);
  const [moreApprovals, setMoreApprovals] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reasonAction, setReasonAction] = useState<'devolver' | 'reabrir' | null>(null);
  const [reason, setReason] = useState('');
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  async function load(signal?: AbortSignal) {
    const [current, history, saved] = await Promise.all([
      api<{ registro: RecordItem }>(`/frequencia/registros/${initial.id}`, { signal }),
      api<{ historico: RecordEvent[] }>(`/frequencia/registros/${initial.id}/historico`, { signal }),
      api<{ aprovacoes: Approval[] }>(`/frequencia/registros/${initial.id}/aprovacoes`, { signal }),
    ]);
    setRecord(current.registro); setDirty(false); setEvents(history.historico); setMoreEvents(history.historico.length === 50); setEventPage(1);
    setApprovals(saved.aprovacoes); setMoreApprovals(saved.aprovacoes.length === 50); setApprovalPage(1);
  }
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).catch((cause: unknown) => { if (!controller.signal.aborted) setError(errorMessage(cause)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [initial.id]);
  async function mutate(path: string, body: unknown, method = 'POST') {
    setBusy(true); setError(''); setNotice('');
    try {
      await api(path, { method, body });
      setReasonAction(null); setReason(''); setCancelConfirm(false); onChanged(); await load(); setNotice('Registro atualizado.');
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        await load().catch(() => undefined); onChanged();
        setError(`${errorMessage(cause)} Confira o conteúdo e a versão atual antes de tentar novamente.`);
      } else setError(errorMessage(cause));
    } finally { setBusy(false); }
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void mutate(`/frequencia/registros/${record.id}`, { versao: record.versao, data: form.get('data'), horaInicio: form.get('horaInicio'), horaFim: form.get('horaFim'), atividades: form.get('atividades') }, 'PUT');
  }
  const editable = user.perfil === 'aluno' && ['rascunho', 'devolvido'].includes(record.status);
  const lastReason = events.find((item) => item.motivo)?.motivo;
  return <Modal title="Registro de estágio" description={`Versão ${record.versao} · ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${record.data}T12:00:00Z`))}`} onClose={onClose}>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    {loading ? <p role="status" className="loading">Carregando registro…</p> : <>
      <div className="detail-status"><StatusLabel status={record.status} /><span>{hours(record.duracaoMinutos)}</span></div>
      {record.status === 'devolvido' && lastReason && <p className="return-reason"><strong>O que precisa ser corrigido</strong>{lastReason}</p>}
      {editable ? <form className="record-form" onSubmit={save} onChange={() => setDirty(true)} key={`${record.id}-${record.versao}`}>
        <label>Data<input name="data" type="date" defaultValue={record.data} max={today()} required /></label>
        <div className="field-pair"><label>Entrada<input name="horaInicio" type="time" defaultValue={record.horaInicio} required /></label><label>Saída<input name="horaFim" type="time" defaultValue={record.horaFim} required /></label></div>
        <label>Atividades<textarea name="atividades" defaultValue={record.atividades} rows={5} required maxLength={4000} /></label>
        <p className="field-hint">Salve as alterações antes de enviar. Não inclua dados que identifiquem pacientes.</p>
        <div className="form-actions"><Button type="submit" disabled={busy}>Salvar alterações</Button><Button variant="ghost" disabled={busy || dirty} onClick={() => void mutate(`/frequencia/registros/${record.id}/enviar`, { versao: record.versao })}>Enviar versão salva</Button></div>
        <Button variant="ghost" size="small" disabled={busy} onClick={() => setCancelConfirm(true)}>Cancelar registro</Button>
        {cancelConfirm && <div className="notice"><p>O registro será cancelado e seu histórico será preservado.</p><Button variant="danger" disabled={busy} onClick={() => void mutate(`/frequencia/registros/${record.id}/cancelar`, { versao: record.versao })}>Confirmar cancelamento</Button><Button variant="ghost" onClick={() => setCancelConfirm(false)}>Voltar</Button></div>}
      </form> : <div className="readonly-record"><span>{record.horaInicio} – {record.horaFim}</span><p>{record.atividades}</p></div>}
      {user.perfil === 'professora' && <div className="review-actions">
        {record.status === 'enviado' && <><Button disabled={busy} onClick={() => void mutate('/frequencia/registros/aprovar', { registros: [{ id: record.id, versao: record.versao }] })}>Aprovar registro</Button><Button variant="ghost" disabled={busy} onClick={() => setReasonAction('devolver')}>Devolver para correção</Button></>}
        {record.status === 'aprovado' && <Button variant="ghost" disabled={busy} onClick={() => setReasonAction('reabrir')}>Reabrir registro</Button>}
        {reasonAction && <form className="reason-form" onSubmit={(event) => { event.preventDefault(); void mutate(`/frequencia/registros/${record.id}/${reasonAction}`, { versao: record.versao, motivo: reason }); }}><label>Motivo da {reasonAction === 'reabrir' ? 'reabertura' : 'devolução'}<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} required rows={3} /></label><Button type="submit" disabled={busy || !reason.trim()}>Confirmar {reasonAction === 'reabrir' ? 'reabertura' : 'devolução'}</Button><Button variant="ghost" disabled={busy} onClick={() => setReasonAction(null)}>Voltar</Button></form>}
      </div>}
      {approvals.length > 0 && <section className="detail-history"><h3>Aprovações</h3>{approvals.map((approval) => <details key={approval.id}><summary>{approval.vigente ? 'Aprovação vigente' : 'Aprovação anterior'} · versão {approval.versao}</summary><p>{approval.snapshot.professora.nome}{approval.snapshot.professora.coren ? ` · ${approval.snapshot.professora.coren}` : ''}</p><p>{approval.snapshot.registro.atividades}</p><p>{hours(approval.snapshot.registro.duracaoMinutos)}</p>{approval.reabertura && <p>Reaberta: {approval.reabertura.motivo}</p>}</details>)}{moreApprovals && <Button variant="ghost" size="small" disabled={busy} onClick={async () => { setBusy(true); try { const result = await api<{ aprovacoes: Approval[] }>(`/frequencia/registros/${record.id}/aprovacoes?pagina=${approvalPage + 1}`); setApprovals((old) => [...old, ...result.aprovacoes]); setApprovalPage(approvalPage + 1); setMoreApprovals(result.aprovacoes.length === 50); } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); } }}>Mais aprovações</Button>}</section>}
      <section className="detail-history"><h3>Histórico</h3>{events.map((item) => <details key={item.id}><summary>{eventLabels[item.acao] ?? item.acao} · versão {item.versao}</summary><time>{new Date(item.criadoEm).toLocaleString('pt-BR')}</time>{item.motivo && <p><strong>Motivo:</strong> {item.motivo}</p>}<p>{item.snapshot.atividades}</p><p>{item.snapshot.data} · {item.snapshot.horaInicio} – {item.snapshot.horaFim} · {hours(item.snapshot.duracaoMinutos)}</p></details>)}
        {moreEvents && <Button variant="ghost" size="small" disabled={busy} onClick={async () => { setBusy(true); try { const result = await api<{ historico: RecordEvent[] }>(`/frequencia/registros/${record.id}/historico?pagina=${eventPage + 1}`); setEvents((old) => [...old, ...result.historico]); setEventPage(eventPage + 1); setMoreEvents(result.historico.length === 50); } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); } }}>Mais histórico</Button>}
      </section>
    </>}
  </Modal>;
}
