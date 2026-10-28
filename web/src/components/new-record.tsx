import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import type { Link, RecordItem } from '../lib/types';
import { errorMessage, hours, today } from '../lib/utils';
import { Modal } from './ui/modal';
import { Button } from './ui/button';

export function NewRecord({ links, onClose, onChanged }: { links: Link[]; onClose: () => void; onChanged: () => void }) {
  const active = links.filter((link) => !link.encerradoEm && !link.estagio.encerradoEm);
  const [linkId, setLinkId] = useState(active[0]?.id ?? '');
  const [date, setDate] = useState(today());
  const [start, setStart] = useState('07:00');
  const [end, setEnd] = useState('13:00');
  const [activities, setActivities] = useState('');
  const [created, setCreated] = useState<RecordItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const duration = (Number(end.slice(0, 2)) * 60 + Number(end.slice(3))) - (Number(start.slice(0, 2)) * 60 + Number(start.slice(3)));
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const send = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'enviar';
    if (duration <= 0) { setError('A saída deve ser depois da entrada, no mesmo dia.'); return; }
    setBusy(true);
    try {
      const data = { data: date, horaInicio: start, horaFim: end, atividades: activities };
      const result = await api<{ registro: RecordItem }>(created ? `/frequencia/registros/${created.id}` : '/frequencia/registros', {
        method: created ? 'PUT' : 'POST', body: created ? { ...data, versao: created.versao } : { ...data, vinculoId: linkId },
      });
      setCreated(result.registro); onChanged();
      if (send) await api(`/frequencia/registros/${result.registro.id}/enviar`, { method: 'POST', body: { versao: result.registro.versao } });
      onChanged(); onClose();
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  const link = active.find((item) => item.id === linkId);
  const min = link ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date(link.iniciadoEm)) : undefined;
  return <Modal title="Novo registro" description="Registre suas atividades e envie para a professora." onClose={onClose}>
    {!active.length ? <div className="empty-state"><h3>Você ainda não tem um vínculo ativo</h3><p>Fale com a coordenação para organizar seu estágio.</p></div> : <form onSubmit={save} className="record-form">
      {created && <p className="notice">O rascunho já está salvo. Você pode ajustar e tentar enviar novamente.</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <label>Estágio<select value={linkId} onChange={(e) => setLinkId(e.target.value)} disabled={Boolean(created) || busy} required>{active.map((item) => <option key={item.id} value={item.id}>{item.estagio.disciplina.nome} · {item.estagio.campoEstagio.nome}</option>)}</select></label>
      <label>Data<input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={min} max={today()} required /></label>
      <div className="field-pair"><label>Entrada<input type="time" value={start} onChange={(e) => setStart(e.target.value)} required /></label><label>Saída<input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required /></label></div>
      <p className="duration-hint">Duração calculada <strong>{duration > 0 ? hours(duration) : '—'}</strong></p>
      <label>Atividades<textarea value={activities} onChange={(e) => setActivities(e.target.value)} required maxLength={4000} rows={5} placeholder="Descreva as atividades realizadas" /></label><p className="field-hint">Não inclua informações que identifiquem pacientes.</p>
      <footer className="form-actions"><Button type="submit" disabled={busy} variant="ghost" value="rascunho">Salvar rascunho</Button><Button type="submit" disabled={busy} value="enviar">{busy ? 'Salvando…' : 'Salvar e enviar'}</Button></footer>
    </form>}
  </Modal>;
}
