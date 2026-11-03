import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { api, allPages } from '../lib/api';
import type { User } from '../lib/types';
import { errorMessage, hours, today } from '../lib/utils';
import { Modal } from '../components/ui/modal';
import { Button } from '../components/ui/button';
import { useOperation, Feedback } from '../coordination/shared';
import { AttendanceEditor } from './attendance-editor';
import type { Session, SessionDetail, SessionRecord } from './types';

const labels = { presente: 'Presente', falta: 'Falta', justificada: 'Falta justificada' };
interface HistoryEvent { id: string; acao: string; criadoEm: string; snapshot: { motivo?: string; frequencia?: { situacao: string; motivo?: string; vinculoId: string } } }

export function SessionDetails({ initial, user, onClose, onChanged, onEdit, onRecord }: { initial: Session; user: User; onClose: () => void; onChanged: () => void; onEdit: (session: Session) => void; onRecord?: (data: SessionRecord) => void }) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [revision, setRevision] = useState(0);
  const [cancel, setCancel] = useState(false); const [notice, setNotice] = useState(''); const [history, setHistory] = useState<HistoryEvent[] | null>(null);
  const operation = useOperation();
  const [callState, setCallState] = useState({ dirty: false, busy: false });
  const [leaveAction, setLeaveAction] = useState<(() => void) | null>(null);
  const requestLeave = (action: () => void) => {
    if (callState.busy) return;
    if (callState.dirty) setLeaveAction(() => action); else action();
  };
  useEffect(() => {
    if (!callState.dirty && !callState.busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [callState.dirty, callState.busy]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    void api<SessionDetail>(`/agenda/sessoes/${initial.id}`, { signal: controller.signal }).then((result) => { if (!controller.signal.aborted) setDetail(result); }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(errorMessage(cause)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [initial.id, revision]);
  const session = detail?.sessao ?? initial; const editor = user.perfil !== 'aluno';
  const canMark = user.perfil === 'professora' && !session.cancelada && session.data <= today();
  const refresh = () => { setHistory(null); setRevision((value) => value + 1); onChanged(); };
  const touched = Boolean(detail?.alunos.some((person) => person.frequencia || person.registro));
  return <Modal title="Sessão de estágio" description={`${session.data.split('-').reverse().join('/')} · ${session.horaInicio} – ${session.horaFim} · ${session.estagio.codigo}`} onClose={() => requestLeave(onClose)}>
    <Dialog.Root open={Boolean(leaveAction)} onOpenChange={(open) => { if (!open) setLeaveAction(null); }}><Dialog.Portal><Dialog.Overlay className="modal-overlay" /><Dialog.Content className="modal-content" aria-describedby="unsaved-call-description" onOpenAutoFocus={(event) => { event.preventDefault(); document.getElementById('continue-call')?.focus(); }}><Dialog.Title>Chamada não salva</Dialog.Title><Dialog.Description id="unsaved-call-description">Você tem alterações na chamada que ainda não foram salvas. Se sair agora, elas serão descartadas.</Dialog.Description><div className="coord-actions"><Button id="continue-call" onClick={() => setLeaveAction(null)}>Continuar chamada</Button><Button variant="outline" onClick={() => { const action = leaveAction; setLeaveAction(null); setCallState({ dirty: false, busy: false }); action?.(); }}>Descartar e sair</Button></div></Dialog.Content></Dialog.Portal></Dialog.Root>
    <Feedback error={error || operation.error} />{notice && <p className="notice" role="status">{notice}</p>}
    {loading ? <p role="status">Carregando chamada…</p> : !detail ? <Button onClick={refresh}>Tentar novamente</Button> : <>
      <div className="coord-detail-info"><strong>{session.estagio.disciplina.nome}</strong><span>{hours(session.duracaoMinutos)} · {session.cancelada ? 'Cancelada' : touched ? 'Frequência lançada' : 'Agendada'}</span></div>
      <p className="muted">{session.estagio.campoEstagio.nome} · {session.estagio.professora.nome}</p>
      <p className="field-hint attendance-explanation">Falta não gera horas. O aluno continua nos próximos dias do cronograma até completar a carga da disciplina. As horas presentes contam após a aprovação das atividades.</p>
      {!session.cancelada && session.data > today() && <p className="notice">A chamada será liberada na data desta sessão. Nenhuma presença foi marcada automaticamente.</p>}
      {canMark ? <AttendanceEditor key={revision} people={detail.alunos} session={session} onSaved={() => { setNotice('Chamada salva.'); refresh(); }} onStateChange={setCallState} onReload={() => requestLeave(() => { setNotice('Chamada atualizada. Confira os lançamentos antes de salvar.'); refresh(); })} /> : <>
        {detail.alunos.map((person) => <article className="agenda-person" key={person.vinculoId}><strong>{person.nome}</strong><p className={person.frequencia?.situacao === 'presente' ? 'success-text' : 'muted'}>{person.frequencia ? labels[person.frequencia.situacao] : 'Sem lançamento'}</p>{person.frequencia?.motivo && <p className="field-hint">{person.frequencia.motivo}</p>}{person.registro && <p className="field-hint">Atividades {person.registro.aprovado ? 'aprovadas' : person.registro.status}</p>}
          {!editor && !session.cancelada && person.frequencia?.situacao === 'presente' && !person.registro && <Button size="small" onClick={() => onRecord?.({ sessaoId: session.id, vinculoId: person.vinculoId, data: session.data, horaInicio: session.horaInicio, horaFim: session.horaFim })}>Registrar atividades</Button>}
        </article>)}{!detail.alunos.length && <p className="empty-state">Nenhum vínculo disponível para esta data.</p>}
        {user.perfil === 'coordenacao' && !session.cancelada && <p className="field-hint">A chamada é preenchida pela professora responsável.</p>}
      </>}
      {editor && <div className="coord-actions session-management">{!session.cancelada && !touched && <><Button variant="outline" onClick={() => requestLeave(() => onEdit(session))}>Alterar sessão</Button><Button variant="outline" disabled={callState.dirty || callState.busy} onClick={() => setCancel(true)}>Cancelar sessão</Button></>}<Button variant="outline" disabled={operation.busy} onClick={() => void operation.run(async () => setHistory(await allPages<HistoryEvent>(`/agenda/sessoes/${session.id}/historico`, 'historico')))}>Ver histórico</Button></div>}
      {cancel && <form className="coord-confirm record-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void operation.run(async () => { await api(`/agenda/sessoes/${session.id}/cancelar`, { method: 'POST', body: { versao: session.versao, motivo: form.get('motivo') } }); setCancel(false); setNotice('Sessão cancelada.'); refresh(); }); }}><label>Motivo do cancelamento<textarea name="motivo" required maxLength={1000} rows={2} /></label><div className="coord-actions"><Button variant="danger" type="submit" disabled={operation.busy || callState.dirty || callState.busy}>Confirmar cancelamento</Button><Button variant="outline" onClick={() => setCancel(false)}>Voltar</Button></div></form>}
      {history && <section className="detail-history"><h3>Histórico</h3>{history.map((event) => <details key={event.id}><summary>{event.acao} · {new Date(event.criadoEm).toLocaleString('pt-BR')}</summary>{event.snapshot.motivo && <p>{event.snapshot.motivo}</p>}{event.snapshot.frequencia && <p>{detail.alunos.find((person) => person.vinculoId === event.snapshot.frequencia!.vinculoId)?.nome ?? 'Vínculo histórico'} · {event.snapshot.frequencia.situacao} · {event.snapshot.frequencia.motivo}</p>}</details>)}</section>}
    </>}
  </Modal>;
}
