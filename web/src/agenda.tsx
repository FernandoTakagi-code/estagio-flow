import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { api, allPages } from './lib/api';
import type { Stage, User } from './lib/types';
import { errorMessage, hours } from './lib/utils';
import { Brand } from './components/brand';
import { Button } from './components/ui/button';
import { SessionForm } from './agenda/session-form';
import { SessionDetails } from './agenda/session-detail';
import type { Session, SessionRecord } from './agenda/types';
import './agenda/styles.css';

type Dialog = { type: 'new' } | { type: 'detail' | 'edit'; session: Session };
export function Agenda({ user, onBack, onRecord }: { user: User; onBack: () => void; onRecord?: (data: SessionRecord) => void }) {
  const [groups, setGroups] = useState<Stage[]>([]); const [sessions, setSessions] = useState<Session[]>([]); const [page, setPage] = useState(1); const [group, setGroup] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [revision, setRevision] = useState(0); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [dialog, setDialog] = useState<Dialog | null>(null);
  useEffect(() => { const controller = new AbortController(); void allPages<Stage>('/academico/estagios', 'estagios', controller.signal).then(setGroups).catch((cause: unknown) => { if (!controller.signal.aborted) setError(errorMessage(cause)); }); return () => controller.abort(); }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); const query = new URLSearchParams({ pagina: String(page) }); if (group) query.set('estagioId', group); if (from) query.set('de', from); if (to) query.set('ate', to);
    void api<{ sessoes: Session[] }>(`/agenda/sessoes?${query}`, { signal: controller.signal }).then((result) => setSessions(result.sessoes)).catch((cause: unknown) => { if (!controller.signal.aborted) setError(errorMessage(cause)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort();
  }, [page, group, from, to, revision]);
  const refresh = () => setRevision((value) => value + 1);
  return <div className="app-shell"><section className="hero hero-compact"><header className="site-header content-width"><Brand /><Button variant="ghost" onClick={onBack}><ChevronLeft size={18} />Voltar</Button></header><div className="hero-content content-width"><div className="hero-intro"><h1>Cronograma</h1><p className="hero-date">Dias de estágio e chamada do grupo.</p><div className="hero-actions">{user.perfil !== 'aluno' && <Button variant="light" onClick={() => setDialog({ type: 'new' })}><Plus size={20} />Nova sessão</Button>}</div></div></div></section><main className="workspace content-width agenda-workspace"><header className="section-header"><h2>Sessões de estágio</h2><Button variant="ghost" onClick={refresh}>Atualizar</Button></header><div className="agenda-filters"><label>Grupo<select value={group} onChange={(event) => { setGroup(event.target.value); setPage(1); }}><option value="">Todos os grupos</option>{groups.map((item) => <option key={item.id} value={item.id}>{item.codigo} · {item.disciplina.nome}</option>)}</select></label><label>De<input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label><label>Até<input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label></div>{error ? <p className="form-error" role="alert">{error}<Button onClick={refresh}>Tentar novamente</Button></p> : loading ? <p role="status" className="loading">Carregando cronograma…</p> : <div>{sessions.map((session) => <button key={session.id} className="agenda-row" onClick={() => setDialog({ type: 'detail', session })}><div><strong>{session.data.split('-').reverse().join('/')}</strong><span>{session.horaInicio} – {session.horaFim} · {hours(session.duracaoMinutos)}</span></div><div><strong>{session.estagio.disciplina.nome}</strong><span>{session.estagio.codigo} · {session.estagio.campoEstagio.nome}</span></div><span className={session.cancelada ? 'muted' : 'success-text'}>{session.cancelada ? 'Cancelada' : 'Agendada'}</span><ChevronRight size={18} /></button>)}{!sessions.length && <p className="empty-state">Nenhuma sessão encontrada neste período.</p>}</div>}<div className="pagination"><Button variant="ghost" disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>Anterior</Button><span>Página {page}</span><Button variant="ghost" disabled={sessions.length < 50 || loading} onClick={() => setPage(page + 1)}>Próxima</Button></div></main><footer className="site-footer content-width"><span>{user.nome}</span><span>Estágio Flow</span></footer>
    {dialog?.type === 'detail' && <SessionDetails initial={dialog.session} user={user} onClose={() => setDialog(null)} onChanged={refresh} onEdit={(session) => setDialog({ type: 'edit', session })} onRecord={onRecord} />}
    {(dialog?.type === 'new' || dialog?.type === 'edit') && <SessionForm groups={groups} initial={dialog.type === 'edit' ? dialog.session : undefined} onClose={() => setDialog(null)} onSaved={refresh} />}
  </div>;
}
