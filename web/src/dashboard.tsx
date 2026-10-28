import { useEffect, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, LogOut, Plus, RefreshCw } from 'lucide-react';
import { api, allPages } from './lib/api';
import type { Hours, Link, Panel, RecordItem, Sheet, Stage, Status, User } from './lib/types';
import { errorMessage, hours, statusLabels } from './lib/utils';
import { Brand } from './components/brand';
import { Button } from './components/ui/button';
import { ProgressRing } from './components/progress-ring';
import { Records } from './components/records';
import { NewRecord } from './components/new-record';
import { RecordDetail } from './components/record-detail';

type View = 'overview' | 'records' | 'sheets';
export function Dashboard({ user, onLogout }: { user: User; onLogout: () => Promise<void> }) {
  const student = user.perfil === 'aluno';
  const teacher = user.perfil === 'professora';
  const [view, setView] = useState<View>('overview');
  const [panel, setPanel] = useState<Panel>({ registros: [], cargaHorariaMinutos: 0 });
  const [links, setLinks] = useState<Link[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [disciplines, setDisciplines] = useState<Hours[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [status, setStatus] = useState<Status | ''>('');
  const [sheetFilter, setSheetFilter] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState<RecordItem | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reloadError, setReloadError] = useState('');
  const refresh = () => { setRevision((old) => old + 1); setSelected([]); };
  function navigate(next: View) { setView(next); setPage(1); setSelected([]); setError(''); setNotice(''); }
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    void Promise.all([
      api<Panel>('/frequencia/painel', { signal: controller.signal }),
      allPages<Sheet>('/frequencia/fichas', 'fichas', controller.signal),
      student ? allPages<Link>('/academico/meus-vinculos', 'vinculos', controller.signal) : allPages<Stage>('/academico/estagios', 'estagios', controller.signal),
      student ? allPages<Hours>(`/frequencia/alunos/${user.id}/horas`, 'disciplinas', controller.signal) : Promise.resolve([]),
    ]).then(([summary, saved, related, course]) => {
      setPanel(summary); setSheets(saved); setDisciplines(course);
      if (student) setLinks(related as Link[]); else setStages(related as Stage[]);
    }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(errorMessage(cause)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user.id, student, revision]);
  useEffect(() => {
    const controller = new AbortController(); setRecordsLoading(true); setReloadError(''); setSelected([]);
    const query = new URLSearchParams({ pagina: String(page) });
    if (status) query.set('status', status); if (sheetFilter) query.set('fichaId', sheetFilter);
    void api<{ registros: RecordItem[] }>(`/frequencia/registros?${query}`, { signal: controller.signal }).then((data) => setRecords(data.registros))
      .catch((cause: unknown) => { if (!controller.signal.aborted) setReloadError(errorMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setRecordsLoading(false); });
    return () => controller.abort();
  }, [page, status, sheetFilter, revision]);
  const metric = (key: Status) => panel.registros.find((item) => item.status === key) ?? { quantidade: 0, minutos: 0 };
  const approved = metric('aprovado');
  const count = panel.registros.filter((item) => item.status !== 'cancelado').reduce((sum, item) => sum + item.quantidade, 0);
  const initials = user.nome.split(' ').filter(Boolean).map((item) => item[0]).slice(0, 2).join('');
  function select(record: RecordItem) {
    setError('');
    if (selected.includes(record.id)) { setSelected(selected.filter((id) => id !== record.id)); return; }
    if (selected.length === 5) { setError('Selecione até cinco registros por vez.'); return; }
    if (selected.length && records.find((item) => item.id === selected[0])?.fichaId !== record.fichaId) { setError('Selecione registros de uma única ficha por vez.'); return; }
    setSelected([...selected, record.id]);
  }
  async function approveSelected() {
    setBusy(true); setError(''); setNotice('');
    try {
      await api('/frequencia/registros/aprovar', { method: 'POST', body: { registros: records.filter((item) => selected.includes(item.id)).map(({ id, versao }) => ({ id, versao })) } });
      setNotice('Lote aprovado.'); refresh();
    } catch (cause) { setError(errorMessage(cause)); refresh(); } finally { setBusy(false); }
  }
  const tabs: (Status | '')[] = ['', 'enviado', 'devolvido', 'aprovado', ...(student || user.perfil === 'coordenacao' ? ['rascunho', 'cancelado'] as Status[] : [])];
  return <div className="app-shell">
    <a href="#workspace" className="skip-link">Ir para o conteúdo</a>
    <section className={`hero ${view !== 'overview' ? 'hero-compact' : ''}`}>
      <header className="site-header content-width"><Brand /><nav aria-label="Navegação principal">{([['overview', 'Visão geral'], ['records', student ? 'Meus registros' : 'Registros'], ['sheets', student ? 'Minhas fichas' : 'Grupos e fichas']] as const).map(([key, label]) => <button key={key} aria-current={view === key ? 'page' : undefined} onClick={() => navigate(key)}>{label}</button>)}</nav><div className="header-user"><span className="avatar" title={user.nome}>{initials}</span><Button variant="ghost" size="icon" aria-label="Sair" onClick={async () => { try { await onLogout(); } catch { /* Local session is cleared even if revocation cannot reach the API. */ } }}><LogOut size={19} /></Button></div></header>
      <div className="hero-content content-width"><div className="hero-intro"><h1>{view === 'records' ? student ? 'Meus registros' : 'Revisar registros' : view === 'sheets' ? student ? 'Minhas fichas' : 'Grupos e fichas' : student ? 'Meu estágio' : teacher ? 'Meus grupos' : 'Visão da coordenação'}</h1><p className="hero-date">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date())}</p>
        <div className="hero-actions">{student ? <Button variant="light" onClick={() => setShowNew(true)} disabled={loading}><Plus size={21} />Novo registro</Button> : <Button variant="light" onClick={() => { setStatus('enviado'); setSheetFilter(''); navigate('records'); }}><CheckIcon />{teacher ? 'Revisar enviados' : 'Consultar registros'}</Button>}<Button variant="ghost" className="hero-secondary" onClick={() => navigate('sheets')}>{student ? 'Ver minha ficha' : 'Ver grupos'}<ArrowRight size={18} /></Button></div>
        {view === 'overview' && <div className="hero-metrics"><div><strong>{student ? hours(metric('enviado').minutos) : metric('enviado').quantidade}</strong><span>Aguardando aprovação</span></div><div><strong>{metric('devolvido').quantidade}<i /></strong><span>{metric('devolvido').quantidade === 1 ? 'Registro para corrigir' : 'Registros para corrigir'}</span></div></div>}
      </div>{view === 'overview' && <ProgressRing student={student} value={student ? approved.minutos : approved.quantidade} total={student ? panel.cargaHorariaMinutos ?? 0 : count} />}</div>
    </section>
    <main id="workspace" className={`workspace content-width ${view === 'overview' ? 'workspace-overview' : ''}`} tabIndex={-1}>
      {error && <div className="workspace-message form-error" role="alert">{error}<Button variant="ghost" size="small" onClick={refresh}>Tentar novamente</Button></div>}{notice && <p className="workspace-message notice" role="status">{notice}</p>}
      {loading ? <p className="workspace-message loading" role="status">Carregando seu estágio…</p> : <>
        {view === 'overview' && <aside className="disciplines"><h2>{student ? 'Disciplinas' : 'Grupos de estágio'}</h2>{student ? <>{disciplines.slice(0, 2).map((course) => {
          const stage = links.find((link) => link.estagio.disciplina.id === course.disciplinaId)?.estagio;
          const ratio = course.cargaHorariaMinutos ? Math.min(100, Math.round(course.minutosAprovados / course.cargaHorariaMinutos * 100)) : 0;
          return <article className="discipline-row" key={course.disciplinaId}><h3>{course.nome}</h3><p>{stage?.campoEstagio.nome} · {stage?.turma.codigo}</p><div className="progress-track" role="progressbar" aria-label={course.nome} aria-valuenow={ratio} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${ratio}%` }} /></div><div className="discipline-numbers"><span><strong>{hours(course.minutosAprovados)}</strong> de {hours(course.cargaHorariaMinutos)}</span><span>{ratio}%</span></div></article>;
        })}{!disciplines.length && <p className="muted">Suas disciplinas aparecerão após a coordenação vincular você a um estágio.</p>}{disciplines.length > 2 && <Button variant="ghost" onClick={() => navigate('sheets')}>Ver todas<ChevronRight size={17} /></Button>}</> : <>{stages.slice(0, 3).map((stage) => <article className="discipline-row" key={stage.id}><h3>{stage.disciplina.nome}</h3><p>{stage.campoEstagio.nome} · {stage.turma.codigo}</p><span className="field-hint">{stage.encerradoEm ? 'Grupo encerrado' : 'Grupo ativo'}</span></article>)}{!stages.length && <p className="muted">Nenhum grupo disponível.</p>}</>}</aside>}
        {view === 'sheets' ? <section className="sheets-region"><h2>{student ? 'Seus vínculos e fichas' : 'Grupos e alunos'}</h2>{!student && stages.map((stage) => <article className="sheet-row" key={stage.id}><div><h3>{stage.disciplina.nome}</h3><p>{stage.campoEstagio.nome} · {stage.turma.codigo} · {stage.codigo}</p><small>{stage.professora.nome} · {stage.encerradoEm ? 'Encerrado' : 'Ativo'}</small></div></article>)}{student && links.map((link) => <article className="sheet-row" key={link.id}><div><h3>{link.estagio.disciplina.nome}</h3><p>{link.estagio.campoEstagio.nome} · {link.estagio.turma.codigo}</p><small>{link.estagio.professora.nome} · {link.encerradoEm ? 'Vínculo encerrado' : 'Vínculo ativo'}</small></div>{sheets.find((sheet) => sheet.vinculoId === link.id) ? <Button variant="ghost" onClick={() => { setSheetFilter(sheets.find((sheet) => sheet.vinculoId === link.id)!.id); setStatus(''); navigate('records'); }}>Ver registros<ChevronRight size={17} /></Button> : <span className="muted">Sem registros</span>}</article>)}{!student && sheets.length > 0 && <h3 className="sheets-title">Fichas dos alunos</h3>}{!student && sheets.map((sheet) => <article className="sheet-row" key={sheet.id}><div><h3>{sheet.vinculo.matricula.aluno.nome}</h3><p>{sheet.vinculo.estagio.disciplina.nome} · {sheet.vinculo.estagio.codigo}</p></div><Button variant="ghost" onClick={() => { setSheetFilter(sheet.id); setStatus(''); navigate('records'); }}>Ver registros<ChevronRight size={17} /></Button></article>)}{!links.length && !stages.length && <p className="empty-state">Nenhum vínculo disponível. Fale com a coordenação.</p>}</section> : <section className="records-region"><header className="section-header"><h2>{view === 'overview' ? 'Registros recentes' : 'Registros de estágio'}</h2>{view === 'overview' ? <Button variant="ghost" onClick={() => navigate('records')}>Ver todos<ChevronRight size={18} /></Button> : <Button variant="ghost" size="icon" aria-label="Atualizar registros" onClick={refresh}><RefreshCw size={18} /></Button>}</header>
          <div className="record-filters"><div className="filter-tabs" aria-label="Filtrar por status">{(view === 'overview' ? tabs.slice(0, 3) : tabs).map((item) => <button key={item} aria-pressed={status === item} onClick={() => { setStatus(item); setPage(1); }}>{item ? statusLabels[item] + (item === 'cancelado' || item === 'rascunho' || item === 'aprovado' ? 's' : 's') : 'Todos'}</button>)}</div>{view === 'records' && <label className="sheet-filter">Ficha<select value={sheetFilter} onChange={(event) => { setSheetFilter(event.target.value); setPage(1); }}><option value="">Todas as fichas</option>{sheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{!student ? sheet.vinculo.matricula.aluno.nome + ' · ' : ''}{sheet.vinculo.estagio.disciplina.nome} · {sheet.vinculo.estagio.codigo}</option>)}</select></label>}</div>
          {teacher && selected.length > 0 && <div className="batch-toolbar"><span>{selected.length} de 5 selecionados</span><Button size="small" disabled={busy || recordsLoading} onClick={() => void approveSelected()}>{busy ? 'Aprovando…' : 'Aprovar selecionados'}</Button><Button variant="ghost" size="small" onClick={() => setSelected([])}>Limpar</Button></div>}
          {reloadError ? <p role="alert" className="form-error">{reloadError}<Button variant="ghost" onClick={refresh}>Tentar novamente</Button></p> : recordsLoading ? <p role="status" className="loading">Carregando registros…</p> : <Records student={student} records={view === 'overview' ? records.slice(0, 4) : records} sheets={sheets} onOpen={setDetail} selectable={teacher} selected={selected} onSelect={select} />}
          {view === 'records' && <div className="pagination"><Button variant="ghost" size="small" disabled={page === 1 || recordsLoading} onClick={() => setPage(page - 1)}><ChevronLeft size={16} />Anterior</Button><span>Página {page}</span><Button variant="ghost" size="small" disabled={records.length < 50 || recordsLoading} onClick={() => setPage(page + 1)}>Próxima<ChevronRight size={16} /></Button></div>}
        </section>}
      </>}
    </main>
    <footer className="site-footer content-width"><span><strong>{user.nome}</strong> · {student ? 'Aluna(o) de Enfermagem' : teacher ? 'Professora' : 'Coordenação'}</span><span>Estágio Flow</span></footer>
    {showNew && <NewRecord links={links} onClose={() => setShowNew(false)} onChanged={refresh} />}{detail && <RecordDetail key={detail.id} initial={detail} user={user} onClose={() => setDetail(null)} onChanged={refresh} />}
  </div>;
}
function CheckIcon() { return <ArrowRight size={20} />; }
