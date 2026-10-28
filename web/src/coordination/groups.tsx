import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { api, allPages } from '../lib/api';
import { errorMessage } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Modal } from '../components/ui/modal';
import { Feedback, matches, Search, useOperation } from './shared';
import type { Group, Member, Registry } from './types';

export function Groups({ data, onOpen }: { data: Registry; onOpen: (group: Group) => void }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('active');
  const groups = data.groups.filter((group) => (status === 'all' || (status === 'active' ? !group.encerradoEm : group.encerradoEm)) && matches(`${group.codigo} ${group.disciplina.nome} ${group.turma.codigo} ${group.professora.nome} ${group.campoEstagio.nome}`, query));
  return <section><header className="section-header"><h2>Grupos de estágio</h2><span className="muted">{groups.length} grupos</span></header><div className="coord-toolbar"><Search value={query} onChange={setQuery} label="Buscar grupo, turma ou professora" /><label>Situação<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Ativos</option><option value="closed">Encerrados</option><option value="all">Todos</option></select></label></div><div className="coord-list">{groups.map((group) => <button className="coord-group coord-list-button" key={group.id} onClick={() => onOpen(group)}><div><strong>{group.disciplina.nome}</strong><span>{group.codigo} · {group.turma.codigo}</span></div><div><span>{group.campoEstagio.nome}</span><span>{group.professora.nome}</span></div><span className={group.encerradoEm ? 'muted' : 'success-text'}>{group.encerradoEm ? 'Encerrado' : 'Ativo'}</span><ChevronRight size={18} /></button>)}{!groups.length && <p className="empty-state">Nenhum grupo encontrado. Cadastre turma, disciplina, local e professora para criar um grupo.</p>}</div></section>;
}
export function NewGroup({ data, onClose, onChanged }: { data: Registry; onClose: () => void; onChanged: () => void }) {
  const operation = useOperation();
  const teachers = data.people.filter((person) => person.perfil === 'professora' && person.ativo);
  const ready = data.classes.length && data.disciplines.length && data.fields.length && teachers.length;
  return <Modal title="Novo grupo de estágio" description="Defina a turma, a disciplina, o local e a professora responsável." onClose={() => { if (!operation.busy) onClose(); }}><Feedback error={operation.error} />{!ready ? <p className="notice">Antes de criar um grupo, cadastre pelo menos uma turma, uma disciplina, um local e uma professora ativa.</p> : <form className="record-form" onSubmit={(event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void operation.run(async () => { await api('/academico/estagios', { method: 'POST', body: Object.fromEntries(form) }); onChanged(); onClose(); });
  }}><label>Código do grupo<input name="codigo" required maxLength={50} /></label><label>Turma<select name="turmaId" required defaultValue=""><option value="" disabled>Selecione</option>{data.classes.map((item) => <option key={item.id} value={item.id}>{item.codigo}</option>)}</select></label><label>Disciplina<select name="disciplinaId" required defaultValue=""><option value="" disabled>Selecione</option>{data.disciplines.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label><label>Local de estágio<select name="campoEstagioId" required defaultValue=""><option value="" disabled>Selecione</option>{data.fields.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label><label>Professora responsável<select name="professoraId" required defaultValue=""><option value="" disabled>Selecione</option>{teachers.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label><p className="field-hint">Mudanças futuras de professora ou local exigem um novo grupo para preservar o histórico.</p><div className="form-actions"><Button type="submit" disabled={operation.busy}>{operation.busy ? 'Criando…' : 'Criar grupo'}</Button></div></form>}</Modal>;
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
  const candidates = data.people.filter((person) => person.perfil === 'aluno' && person.ativo && data.enrollments.some((item) => item.alunoId === person.id && item.turmaId === group.turma.id) && !members.some((item) => item.matricula.aluno.id === person.id && !item.encerradoEm));
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
    {!current.encerradoEm && <form className="record-form coord-detail-section" onSubmit={(event) => { event.preventDefault(); setConfirmation({ action: 'assign', alunoId: studentId, nome: data.people.find((item) => item.id === studentId)?.nome }); }}><h3>Adicionar aluno</h3><label>Aluno da turma<select value={studentId} onChange={(event) => setStudentId(event.target.value)} required><option value="">Selecione um aluno</option>{candidates.map((person) => <option key={person.id} value={person.id}>{person.nome}</option>)}</select></label><p className="field-hint">Aparecem alunos ativos matriculados em {group.turma.codigo}, que ainda não têm vínculo ativo neste grupo.</p><Button type="submit" disabled={operation.busy || loading || Boolean(loadError) || !studentId}>Vincular aluno</Button></form>}
    <section className="coord-detail-section"><h3>Alunos e histórico de vínculos</h3>{loading ? <p role="status">Carregando alunos…</p> : loadError ? <p role="alert" className="form-error">{loadError}<Button variant="ghost" onClick={() => setRevision((value) => value + 1)}>Tentar novamente</Button></p> : members.length ? members.map((member) => <article className="coord-member" key={member.id}><div><strong>{member.matricula.aluno.nome}</strong><p className="field-hint">{member.encerradoEm ? `Encerrado em ${new Date(member.encerradoEm).toLocaleDateString('pt-BR')}` : 'Vínculo ativo'}</p></div>{!member.encerradoEm && !current.encerradoEm && <Button variant="ghost" size="small" disabled={operation.busy} onClick={() => setConfirmation({ action: 'remove', alunoId: member.matricula.aluno.id, nome: member.matricula.aluno.nome })}>Encerrar vínculo</Button>}</article>) : <p className="muted">Nenhum aluno vinculado a este grupo.</p>}</section>
    {!current.encerradoEm && <Button variant="ghost" disabled={operation.busy} onClick={() => setConfirmation({ action: 'close' })}>Encerrar grupo</Button>}
    {confirmation && <div className="coord-confirm" role="region" aria-label="Confirmar alteração"><p>{confirmation.action === 'assign' ? `Vincular ${confirmation.nome} a este grupo? Se o aluno já participa de outro grupo da mesma disciplina, o vínculo anterior será encerrado.` : confirmation.action === 'remove' ? `Encerrar o vínculo de ${confirmation.nome}? Os registros e o histórico permanecem.` : 'Encerrar este grupo também encerra seus vínculos ativos. Isso não é o fechamento definitivo das fichas de frequência.'}</p><div className="coord-actions"><Button disabled={operation.busy} onClick={() => void confirm()}>{operation.busy ? 'Salvando…' : 'Confirmar alteração'}</Button><Button variant="ghost" disabled={operation.busy} onClick={() => setConfirmation(null)}>Voltar</Button></div></div>}
  </Modal>;
}
