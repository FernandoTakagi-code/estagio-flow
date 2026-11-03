import { useEffect, useState } from 'react';
import { api, allPages } from '../lib/api';
import { errorMessage } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Modal } from '../components/ui/modal';
import { Feedback, InvitationList, useOperation } from './shared';
import type { Enrollment, Invitation, Invite, Person, Registry } from './types';

export function NewPerson({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const operation = useOperation();
  const [role, setRole] = useState('aluno');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  return <Modal title={invitations.length ? 'Pessoa cadastrada' : 'Cadastrar pessoa'} description="O acesso é liberado por convite, sem definir a senha pela coordenação." onClose={() => { if (!operation.busy) onClose(); }}>
    <Feedback error={operation.error} />{invitations.length ? <InvitationList invitations={invitations} /> : <form className="record-form" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      void operation.run(async () => {
        const response = await api<{ usuario: Person; convite: Invite }>('/usuarios', { method: 'POST', body: { nome: form.get('nome'), email: form.get('email'), perfil: role, ...(role === 'professora' && form.get('coren') ? { coren: form.get('coren') } : {}) } });
        setInvitations([{ ...response.usuario, convite: response.convite }]); onChanged();
      });
    }}><label>Nome<input name="nome" required minLength={2} maxLength={200} autoComplete="name" /></label><label>E-mail<input name="email" type="email" required maxLength={254} autoComplete="email" /></label><label>Perfil<select value={role} onChange={(event) => setRole(event.target.value)}><option value="aluno">Aluno</option><option value="professora">Professora</option></select></label>{role === 'professora' && <label>COREN (opcional)<input name="coren" maxLength={30} /></label>}<div className="form-actions"><Button type="submit" disabled={operation.busy}>{operation.busy ? 'Cadastrando…' : 'Cadastrar e gerar convite'}</Button></div></form>}
  </Modal>;
}
export function PersonDetail({ person, data, onClose, onChanged }: { person: Person; data: Registry; onClose: () => void; onChanged: () => void }) {
  const [current, setCurrent] = useState(person);
  const operation = useOperation();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [history, setHistory] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(person.perfil === 'aluno');
  const [historyError, setHistoryError] = useState('');
  const [revision, setRevision] = useState(0);
  const [classId, setClassId] = useState('');
  const [confirmation, setConfirmation] = useState<'active' | 'enroll' | 'close' | 'invite' | null>(null);
  const enrollment = current.matriculaAtiva;
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setHistoryError('');
    void Promise.all([api<{ usuario: Person }>(`/usuarios/${person.id}`, { signal: controller.signal }), person.perfil === 'aluno' ? allPages<Enrollment>(`/academico/alunos/${person.id}/matriculas`, 'matriculas', controller.signal) : Promise.resolve([])]).then(([response, rows]) => { if (!controller.signal.aborted) { setCurrent(response.usuario); setHistory(rows); } }).catch((cause: unknown) => { if (!controller.signal.aborted) setHistoryError(errorMessage(cause)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [person.id, person.perfil, revision]);
  async function confirm() {
    await operation.run(async () => {
      if (confirmation === 'active') await api(`/usuarios/${person.id}/ativo`, { method: 'PATCH', body: { ativo: !current.ativo } });
      if (confirmation === 'invite') { const response = await api<{ convite: Invite }>(`/usuarios/${person.id}/convite`, { method: 'POST' }); setInvitations([{ ...current, convite: response.convite }]); }
      if (confirmation === 'enroll') await api(`/academico/alunos/${person.id}/turma`, { method: 'PUT', body: { turmaId: classId } });
      if (confirmation === 'close') await api(`/academico/alunos/${person.id}/turma/encerrar`, { method: 'POST' });
      setConfirmation(null); setRevision((value) => value + 1); onChanged();
    });
  }
  return <Modal title={person.nome} description={person.email} onClose={() => { if (!operation.busy) onClose(); }}><Feedback error={operation.error || historyError} />
    <div className="coord-detail-info"><span>{person.perfil === 'aluno' ? 'Aluno' : 'Professora'}</span><strong>{!current.ativo ? 'Conta desativada' : current.convitePendente ? 'Convite pendente' : 'Conta ativa'}</strong></div>
    {person.coren && <p className="muted">{person.coren}</p>}
    <div className="coord-actions">{current.ativo && current.convitePendente && <Button variant="ghost" onClick={() => setConfirmation('invite')} disabled={operation.busy || loading || Boolean(historyError)}>Gerar novo convite</Button>}<Button variant="ghost" onClick={() => setConfirmation('active')} disabled={operation.busy || loading || Boolean(historyError)}>{current.ativo ? 'Desativar conta' : 'Reativar conta'}</Button></div>
    {person.perfil === 'aluno' && <section className="coord-detail-section"><h3>Matrícula</h3><p className="muted">{enrollment ? `Turma atual: ${enrollment.turma.codigo}` : 'Aluno sem turma ativa.'}</p><form className="record-form" onSubmit={(event) => { event.preventDefault(); setConfirmation('enroll'); }}><label>Turma<select required value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">Selecione uma turma</option>{data.classes.map((item) => <option key={item.id} value={item.id}>{item.codigo}</option>)}</select></label><div className="coord-actions"><Button type="submit" disabled={!current.ativo || operation.busy || !classId || classId === enrollment?.turmaId}>{enrollment ? 'Transferir de turma' : 'Matricular'}</Button>{enrollment && <Button variant="ghost" disabled={operation.busy} onClick={() => setConfirmation('close')}>Encerrar matrícula</Button>}</div></form>
      <h3 className="coord-history-heading">Histórico de turmas</h3>{loading ? <p role="status">Carregando matrículas…</p> : historyError ? <p role="alert" className="form-error">{historyError}<Button variant="ghost" onClick={() => setRevision((value) => value + 1)}>Tentar novamente</Button></p> : history.length ? history.map((item) => <p className="coord-history-line" key={item.id}><strong>{item.turma.codigo}</strong><span>{new Date(item.iniciadoEm).toLocaleDateString('pt-BR')} · {item.encerradoEm ? `Encerrada em ${new Date(item.encerradoEm).toLocaleDateString('pt-BR')}` : 'Ativa'}</span></p>) : <p className="muted">Nenhuma matrícula anterior.</p>}
    </section>}
    {confirmation && <div className="coord-confirm" role="region" aria-label="Confirmar alteração"><p>{confirmation === 'active' ? current.ativo ? 'Desativar impede o login, encerra as sessões e revoga convites. Matrículas e histórico permanecem.' : 'Reativar permite o acesso novamente. Se a conta ainda não tem senha, será necessário gerar outro convite.' : confirmation === 'invite' ? 'O convite anterior será revogado. Guarde o novo link antes de fechar.' : confirmation === 'enroll' ? `Confirmar matrícula em ${data.classes.find((item) => item.id === classId)?.codigo}? Uma transferência encerra a matrícula anterior e todos os vínculos ativos de estágio do aluno.` : 'Encerrar a matrícula também encerra todos os vínculos ativos de estágio do aluno. O histórico permanece.'}</p><div className="coord-actions"><Button disabled={operation.busy} onClick={() => void confirm()}>{operation.busy ? 'Salvando…' : 'Confirmar alteração'}</Button><Button variant="ghost" disabled={operation.busy} onClick={() => setConfirmation(null)}>Voltar</Button></div></div>}
    {invitations.length > 0 && <InvitationList invitations={invitations} />}
  </Modal>;
}
