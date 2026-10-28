import { useEffect, useState } from 'react';
import { LogOut, Plus, RefreshCw, Upload } from 'lucide-react';
import { allPages } from './lib/api';
import type { User } from './lib/types';
import { errorMessage } from './lib/utils';
import { Brand } from './components/brand';
import { Button } from './components/ui/button';
import { Dashboard } from './dashboard';
import { NewPerson, People, PersonDetail } from './coordination/people';
import { Catalogs, NewCatalog, type Catalog } from './coordination/catalogs';
import { GroupDetail, Groups, NewGroup } from './coordination/groups';
import { ImportStudents } from './coordination/import-students';
import type { Discipline, Enrollment, Field, Group, Person, Registry, SchoolClass } from './coordination/types';
import './coordination/styles.css';

type View = 'people' | 'catalogs' | 'groups' | 'records';
type Dialog = { kind: 'person'; person: Person } | { kind: 'group'; group: Group } | { kind: 'catalog'; catalog: Catalog } | { kind: 'newPerson' | 'newGroup' | 'import' };
const titles: Record<View, string> = { people: 'Pessoas', catalogs: 'Turmas e locais', groups: 'Grupos', records: 'Registros' };
const empty: Registry = { people: [], classes: [], disciplines: [], fields: [], groups: [], enrollments: [] };
export function Coordination({ user, onLogout }: { user: User; onLogout: () => Promise<void> }) {
  const [view, setView] = useState<View>('people');
  const [data, setData] = useState<Registry>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const refresh = () => setRevision((value) => value + 1);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    void Promise.all([
      allPages<Person>('/usuarios', 'usuarios', controller.signal), allPages<SchoolClass>('/academico/turmas', 'turmas', controller.signal),
      allPages<Discipline>('/academico/disciplinas', 'disciplinas', controller.signal), allPages<Field>('/academico/campos-estagio', 'camposEstagio', controller.signal),
      allPages<Group>('/academico/estagios', 'estagios', controller.signal), allPages<Enrollment>('/academico/matriculas', 'matriculas', controller.signal),
    ]).then(([people, classes, disciplines, fields, groups, enrollments]) => { if (!controller.signal.aborted) setData({ people, classes, disciplines, fields, groups, enrollments }); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(errorMessage(cause)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  const close = () => setDialog(null);
  if (view === 'records') return <Dashboard user={user} onLogout={onLogout} onBack={() => setView('people')} />;
  return <div className="app-shell"><a href="#coord-workspace" className="skip-link">Ir para o conteúdo</a><section className="hero hero-compact coord-hero"><header className="site-header content-width"><Brand /><nav aria-label="Navegação principal">{(Object.keys(titles) as View[]).map((item) => <button key={item} aria-current={item === view ? 'page' : undefined} onClick={() => { setView(item); }}>{titles[item]}</button>)}</nav><div className="header-user"><span className="avatar" title={user.nome}>{user.nome.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('')}</span><Button variant="ghost" size="icon" aria-label="Sair" onClick={async () => { try { await onLogout(); } catch { /* The local session is cleared by the parent. */ } }}><LogOut size={19} /></Button></div></header><div className="hero-content content-width"><div className="hero-intro"><h1>{titles[view]}</h1><p className="hero-date">{view === 'people' ? 'Alunos e professoras, organizados em um só lugar.' : view === 'catalogs' ? 'A base para organizar cada estágio.' : 'Turma, disciplina, local e professora responsável.'}</p><div className="hero-actions">{view === 'people' ? <><Button variant="light" disabled={loading || Boolean(error)} onClick={() => setDialog({ kind: 'newPerson' })}><Plus size={20} />Cadastrar pessoa</Button><Button variant="ghost" onClick={() => setDialog({ kind: 'import' })} disabled={loading || Boolean(error)}><Upload size={18} />Importar alunos</Button></> : view === 'groups' ? <Button variant="light" disabled={loading || Boolean(error)} onClick={() => setDialog({ kind: 'newGroup' })}><Plus size={20} />Novo grupo</Button> : <Button variant="light" onClick={() => setDialog({ kind: 'catalog', catalog: 'classes' })} disabled={loading || Boolean(error)}><Plus size={20} />Nova turma</Button>}</div></div></div></section>
    <main className="workspace content-width coord-workspace" id="coord-workspace" tabIndex={-1}><div className="coord-refresh"><span className="muted">Coordenação</span><Button variant="ghost" size="small" disabled={loading} onClick={refresh}><RefreshCw size={16} />Atualizar</Button></div>{error && <p className="form-error" role="alert">{error}<Button variant="ghost" onClick={refresh}>Tentar novamente</Button></p>}{loading ? <p className="loading" role="status">Carregando cadastros…</p> : error ? null : view === 'people' ? <People data={data} onOpen={(person) => setDialog({ kind: 'person', person })} /> : view === 'catalogs' ? <Catalogs data={data} onNew={(catalog) => setDialog({ kind: 'catalog', catalog })} /> : <Groups data={data} onOpen={(group) => setDialog({ kind: 'group', group })} />}</main>
    <footer className="site-footer content-width"><span>{user.nome} · Coordenação</span><span>Estágio Flow</span></footer>
    {dialog?.kind === 'newPerson' && <NewPerson onClose={close} onChanged={refresh} />}{dialog?.kind === 'person' && <PersonDetail person={dialog.person} data={data} onClose={close} onChanged={refresh} />}{dialog?.kind === 'catalog' && <NewCatalog kind={dialog.catalog} onClose={close} onChanged={refresh} />}{dialog?.kind === 'newGroup' && <NewGroup data={data} onClose={close} onChanged={refresh} />}{dialog?.kind === 'group' && <GroupDetail group={dialog.group} data={data} onClose={close} onChanged={refresh} />}{dialog?.kind === 'import' && <ImportStudents onClose={close} onChanged={refresh} />}
  </div>;
}
