import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Search } from './shared';
import { usePeople } from './use-people';
import type { Person } from './types';

export function People({ revision, onOpen }: { revision: number; onOpen: (person: Person) => void }) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const { people, total, loading, error } = usePeople(query, role, page, revision + retry);
  return <section><header className="section-header"><h2>Alunos e professoras</h2><span className="muted">{loading ? 'Carregando…' : `${total} pessoas`}</span></header><div className="coord-toolbar"><Search value={query} onChange={(value) => { setQuery(value); setPage(1); }} /><label>Perfil<select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }}><option value="">Todos</option><option value="aluno">Alunos</option><option value="professora">Professoras</option></select></label></div>
    {error ? <p role="alert" className="form-error">{error}<Button variant="ghost" onClick={() => setRetry((value) => value + 1)}>Tentar novamente</Button></p> : loading ? <p role="status" className="loading">Carregando pessoas…</p> : <div className="coord-list">{people.map((person) => <button className="coord-person coord-list-button" key={person.id} onClick={() => onOpen(person)}><div><strong>{person.nome}</strong><span>{person.email}</span></div><span>{person.perfil === 'aluno' ? 'Aluno' : 'Professora'}</span><span>{person.perfil === 'aluno' ? person.matriculaAtiva?.turma.codigo ?? 'Sem turma' : person.coren ?? 'COREN não informado'}</span><span className={!person.ativo ? 'muted' : person.convitePendente ? 'attention-text' : 'success-text'}>{!person.ativo ? 'Desativada' : person.convitePendente ? 'Convite pendente' : 'Ativa'}</span><ChevronRight size={18} /></button>)}{!people.length && <p className="empty-state">Nenhuma pessoa encontrada. Cadastre uma pessoa ou importe alunos.</p>}</div>}
    <div className="pagination"><Button variant="ghost" size="small" disabled={loading || page === 1} onClick={() => setPage(page - 1)}>Anterior</Button><span>Página {page}</span><Button variant="ghost" size="small" disabled={loading || Boolean(error) || page * 50 >= total} onClick={() => setPage(page + 1)}>Próxima</Button></div>
  </section>;
}
