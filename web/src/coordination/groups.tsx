import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { api, allPages } from '../lib/api';
import { errorMessage } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Modal } from '../components/ui/modal';
import { Feedback, matches, Search, useOperation } from './shared';
import { usePeople } from './use-people';
import type { Group, Member, Registry } from './types';

export function Groups({ data, onOpen }: { data: Registry; onOpen: (group: Group) => void }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('active');
  const groups = data.groups.filter((group) => (status === 'all' || (status === 'active' ? !group.encerradoEm : group.encerradoEm)) && matches(`${group.codigo} ${group.disciplina.nome} ${group.turma.codigo} ${group.professora.nome} ${group.campoEstagio.nome}`, query));
  return <section><header className="section-header"><h2>Grupos de estágio</h2><span className="muted">{groups.length} grupos</span></header><div className="coord-toolbar"><Search value={query} onChange={setQuery} label="Buscar grupo, turma ou professora" /><label>Situação<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Ativos</option><option value="closed">Encerrados</option><option value="all">Todos</option></select></label></div><div className="coord-list">{groups.map((group) => <button className="coord-group coord-list-button" key={group.id} onClick={() => onOpen(group)}><div><strong>{group.disciplina.nome}</strong><span>{group.codigo} · {group.turma.codigo}</span></div><div><span>{group.campoEstagio.nome}</span><span>{group.professora.nome}</span></div><span className={group.encerradoEm ? 'muted' : 'success-text'}>{group.encerradoEm ? 'Encerrado' : 'Ativo'}</span><ChevronRight size={18} /></button>)}{!groups.length && <p className="empty-state">Nenhum grupo encontrado. Cadastre turma, disciplina, local e professora para criar um grupo.</p>}</div></section>;
}
export function NewGroup({ data, onClose, onChanged }: { data: Registry; onClose: () => void; onChanged: () => void }) {
  const operation = useOperation();
  const [teacherQuery, setTeacherQuery] = useState('');
  const [teacherPage, setTeacherPage] = useState(1);
  const [teacherId, setTeacherId] = useState('');
  const { people: teachers, total: teacherTotal, loading: teachersLoading, error: teacherError } = usePeople(teacherQuery, 'professora', teacherPage, 0, true);
  const ready = data.classes.length && data.disciplines.length && data.fields.length;
  return <Modal title="Novo grupo de estágio" description="Defina a turma, a disciplina, o local e a professora responsável." onClose={() => { if (!operation.busy) onClose(); }}><Feedback error={operation.error} />{!ready ? <p className="notice">Antes de criar um grupo, cadastre pelo menos uma turma, uma disciplina, um local e uma professora ativa.</p> : <form className="record-form" onSubmit={(event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void operation.run(async () => { await api('/academico/estagios', { method: 'POST', body: Object.fromEntries(form) }); onChanged(); onClose(); });
  }}><label>Código do grupo<input name="codigo" required maxLength={50} /></label><label>Turma<select name="turmaId" required defaultValue=""><option value="" disabled>Selecione</option>{data.classes.map((item) => <option key={item.id} value={item.id}>{item.codigo}</option>)}</select></label><label>Disciplina<select name="disciplinaId" required defaultValue=""><option value="" disabled>Selecione</option>{data.disciplines.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label><label>Local de estágio<select name="campoEstagioId" required defaultValue=""><option value="" disabled>Selecione</option>{data.fields.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label><Search value={teacherQuery} onChange={(value) => { setTeacherQuery(value); setTeacherPage(1); setTeacherId(''); }} label="Buscar professora" /><Feedback error={teacherError} /><label>Professora responsável<select name="professoraId" required value={teacherId} onChange={(event) => setTeacherId(event.target.value)} disabled={teachersLoading || Boolean(teacherError)}><option value="" disabled>Selecione</option>{teachers.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label><p className="field-hint">{teachersLoading ? 'Carregando professoras…' : teacherTotal ? `${teacherTotal} professoras encontradas` : 'Nenhuma professora ativa encontrada.'}</p><div className="pagination"><Button variant="ghost" size="small" disabled={teachersLoading || teacherPage === 1} onClick={() => { setTeacherPage(teacherPage - 1); setTeacherId(''); }}>Anterior</Button><span>Página {teacherPage}</span><Button variant="ghost" size="small" disabled={teachersLoading || teacherPage * 50 >= teacherTotal} onClick={() => { setTeacherPage(teacherPage + 1); setTeacherId(''); }}>Próxima</Button></div><p className="field-hint">Mudanças futuras de professora ou local exigem um novo grupo para preservar o histórico.</p><div className="form-actions"><Button type="submit" disabled={operation.busy || teachersLoading || Boolean(teacherError) || !teacherId}>{operation.busy ? 'Criando…' : 'Criar grupo'}</Button></div></form>}</Modal>;
}
export function GroupDetail({ group, data, onClose, onChanged }: { group: Group; data: Registry; onClose: () => void; onChanged: () => void }) {
  const current = data.groups.find((item) => item.id === group.id) ?? group;
  const operation = useOperation();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [studentId, setStudentId] = useState('');
  const [confirmation, setConfirmation] = useState<{ action: 'assign' | 'remove' | 'close'; alunoId?: string; nome?: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setLoadError('');
    void allPages<Member>(`/academico/estagios/${group.id}/alunos`, 'vinculos', controller.signal).then(setMembers).catch((cause: unknown) => { if (!controller.signal.aborted) setLoadError(errorMessage(cause)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [group.id, revision]);
  const [candidates, setCandidates] = useState<{ id: string; nome: string }[]>([]);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [candidatePage, setCandidatePage] = useState(1);
  const [candidatesLoading, setCandidatesLoading] = useState(true);
  const [candidateError, setCandidateError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setCandidates([]); setStudentId(''); setCandidateError('');
    if (current.encerradoEm) { setCandidatesLoading(false); return () => controller.abort(); }
    setCandidatesLoading(true);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ pagina: String(candidatePage), busca: candidateQuery.trim() });
      void api<{ alunos: { id: string; nome: string }[] }>(`/academico/estagios/${group.id}/alunos-elegiveis?${params}`, { signal: controller.signal }).then((response) => { if (!controller.signal.aborted) setCandidates(response.alunos); })
        .catch((cause: unknown) => { if (!controller.signal.aborted) setCandidateError(errorMessage(cause)); }).finally(() => { if (!controller.signal.aborted) setCandidatesLoading(false); });
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [group.id, current.encerradoEm, candidatePage, candidateQuery, revision]);
  async function confirm() {
    if (!confirmation) return;
    await operation.run(async () => {
      const path = `/academico/estagios/${group.id}`;
      if (confirmation.action === 'assign') await api(`${path}/alunos`, { method: 'POST', body: { alunoId: confirmation.alunoId } });
      if (confirmation.action === 'remove') await api(`${path}/alunos/${confirmation.alunoId}/encerrar`, { method: 'POST' });
      if (confirmation.action === 'close') await api(`${path}/encerrar`, { method: 'POST' });
      setConfirmation(null); setStudentId(''); setRevision((value) => value + 1); onChanged();
    });
  }
  return <Modal title={group.codigo} description={`${group.disciplina.nome} · ${group.turma.codigo}`} onClose={() => { if (!operation.busy) onClose(); }}><Feedback error={operation.error} /><div className="coord-detail-info"><span>{group.campoEstagio.nome}</span><strong>{current.encerradoEm ? 'Grupo encerrado' : 'Grupo ativo'}</strong></div><p className="muted">{group.professora.nome}</p>
    {!current.encerradoEm && <form className="record-form coord-detail-section" onSubmit={(event) => { event.preventDefault(); setConfirmation({ action: 'assign', alunoId: studentId, nome: candidates.find((item) => item.id === studentId)?.nome }); }}><h3>Adicionar aluno</h3><Search value={candidateQuery} onChange={(value) => { setCandidateQuery(value); setCandidatePage(1); }} label="Buscar aluno" /><Feedback error={candidateError} /><label>Aluno da turma<select value={studentId} onChange={(event) => setStudentId(event.target.value)} required><option value="">Selecione um aluno</option>{candidates.map((person) => <option key={person.id} value={person.id}>{person.nome}</option>)}</select></label><p className="field-hint">Aparecem alunos ativos matriculados em {group.turma.codigo}, que ainda não têm vínculo ativo neste grupo.</p><Button type="submit" disabled={operation.busy || loading || Boolean(loadError) || candidatesLoading || Boolean(candidateError) || !studentId}>Vincular aluno</Button><p className="field-hint">{candidatesLoading ? 'Carregando alunos disponíveis…' : !candidates.length ? 'Nenhum aluno disponível nesta página.' : ''}</p><div className="pagination"><Button variant="ghost" size="small" disabled={candidatesLoading || candidatePage === 1} onClick={() => setCandidatePage(candidatePage - 1)}>Anterior</Button><span>Página {candidatePage}</span><Button variant="ghost" size="small" disabled={candidatesLoading || Boolean(candidateError) || candidates.length < 50} onClick={() => setCandidatePage(candidatePage + 1)}>Próxima</Button></div></form>}
    <section className="coord-detail-section"><h3>Alunos e histórico de vínculos</h3>{loading ? <p role="status">Carregando alunos…</p> : loadError ? <p role="alert" className="form-error">{loadError}<Button variant="ghost" onClick={() => setRevision((value) => value + 1)}>Tentar novamente</Button></p> : members.length ? members.map((member) => <article className="coord-member" key={member.id}><div><strong>{member.matricula.aluno.nome}</strong><p className="field-hint">{member.encerradoEm ? `Encerrado em ${new Date(member.encerradoEm).toLocaleDateString('pt-BR')}` : 'Vínculo ativo'}</p></div>{!member.encerradoEm && !current.encerradoEm && <Button variant="ghost" size="small" disabled={operation.busy} onClick={() => setConfirmation({ action: 'remove', alunoId: member.matricula.aluno.id, nome: member.matricula.aluno.nome })}>Encerrar vínculo</Button>}</article>) : <p className="muted">Nenhum aluno vinculado a este grupo.</p>}</section>
    {!current.encerradoEm && <Button variant="ghost" disabled={operation.busy} onClick={() => setConfirmation({ action: 'close' })}>Encerrar grupo</Button>}
    {confirmation && <div className="coord-confirm" role="region" aria-label="Confirmar alteração"><p>{confirmation.action === 'assign' ? `Vincular ${confirmation.nome} a este grupo? Se o aluno já participa de outro grupo da mesma disciplina, o vínculo anterior será encerrado.` : confirmation.action === 'remove' ? `Encerrar o vínculo de ${confirmation.nome}? Os registros e o histórico permanecem.` : 'Encerrar este grupo também encerra seus vínculos ativos. Isso não é o fechamento definitivo das fichas de frequência.'}</p><div className="coord-actions"><Button disabled={operation.busy} onClick={() => void confirm()}>{operation.busy ? 'Salvando…' : 'Confirmar alteração'}</Button><Button variant="ghost" disabled={operation.busy} onClick={() => setConfirmation(null)}>Voltar</Button></div></div>}
  </Modal>;
}
