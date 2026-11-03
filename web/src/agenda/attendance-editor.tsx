import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Feedback, useOperation } from '../coordination/shared';
import type { Attendee, Session } from './types';

type Situation = 'presente' | 'falta' | 'justificada';
interface Draft { situacao: Situation; motivo: string }
const labels = { presente: 'Presente', falta: 'Falta', justificada: 'Falta justificada' };

export function AttendanceEditor({ people, session, onSaved, onReload, onStateChange }: { people: Attendee[]; session: Session; onSaved: () => void; onReload: () => void; onStateChange: (state: { dirty: boolean; busy: boolean }) => void }) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const operation = useOperation();
  const pending = people.filter((person) => drafts[person.vinculoId] && drafts[person.vinculoId]!.situacao !== person.frequencia?.situacao);
  const dirty = pending.length > 0;
  useEffect(() => { onStateChange({ dirty, busy: operation.busy }); }, [dirty, operation.busy, onStateChange]);
  const present = people.filter((person) => (drafts[person.vinculoId]?.situacao ?? person.frequencia?.situacao) === 'presente').length;
  const absent = people.filter((person) => ['falta', 'justificada'].includes(drafts[person.vinculoId]?.situacao ?? person.frequencia?.situacao ?? '')).length;
  function choose(person: Attendee, situacao: Situation) { setDrafts((old) => ({ ...old, [person.vinculoId]: { situacao, motivo: old[person.vinculoId]?.motivo ?? '' } })); }
  return <form className="attendance-editor" onSubmit={(event) => {
    event.preventDefault(); if (!pending.length) return;
    void operation.run(async () => {
      await api(`/agenda/sessoes/${session.id}/chamada`, { method: 'PUT', body: { lancamentos: pending.map((person) => ({ vinculoId: person.vinculoId, versao: person.frequencia?.versao ?? 0, situacao: drafts[person.vinculoId]!.situacao, motivo: drafts[person.vinculoId]!.motivo || undefined })) } });
      setDrafts({}); onStateChange({ dirty: false, busy: false }); onSaved();
    });
  }}>
    <header className="attendance-heading"><h3>Chamada do grupo</h3><p>Marque cada aluno e salve a chamada. Quem ainda não foi marcado continua sem lançamento.</p><p className="attendance-counts">{present} {present === 1 ? 'presente' : 'presentes'} · {absent} {absent === 1 ? 'falta' : 'faltas'} · {people.length - present - absent} sem lançamento</p></header>
    <Feedback error={operation.error} />
    {people.map((person) => {
      const draft = drafts[person.vinculoId]; const situation = draft?.situacao ?? person.frequencia?.situacao;
      const changed = pending.some((item) => item.vinculoId === person.vinculoId);
      const needsReason = changed && (Boolean(person.frequencia) || situation === 'justificada');
      const hasRecord = Boolean(person.registro);
      return <article className="attendance-row" key={person.vinculoId}>
        <div className="attendance-person"><strong>{person.nome}</strong><span>{changed ? 'Alteração não salva' : person.frequencia ? labels[person.frequencia.situacao] : 'Sem lançamento'}</span>{person.registro && <span>Atividades: {person.registro.aprovado ? 'aprovadas' : person.registro.status}</span>}</div>
        <div className="attendance-options" role="group" aria-label={`Frequência de ${person.nome}`}>
          <Button className={`attendance-choice ${situation === 'presente' ? 'choice-present' : ''}`} variant="outline" aria-pressed={situation === 'presente'} disabled={operation.busy} onClick={() => choose(person, 'presente')}>Presente</Button>
          <Button className={`attendance-choice ${situation === 'falta' || situation === 'justificada' ? 'choice-absent' : ''}`} variant="outline" aria-pressed={situation === 'falta' || situation === 'justificada'} disabled={operation.busy || hasRecord} onClick={() => choose(person, 'falta')}>Falta</Button>
        </div>
        {hasRecord && <p className="field-hint attendance-wide">Há atividades registradas. Resolva o registro antes de mudar para falta.</p>}
        {(situation === 'falta' || situation === 'justificada') && <label className="attendance-justify attendance-wide"><input type="checkbox" checked={situation === 'justificada'} disabled={operation.busy || hasRecord} onChange={(event) => choose(person, event.target.checked ? 'justificada' : 'falta')} />Justificar falta</label>}
        {needsReason && <label className="attendance-wide">{person.frequencia ? 'Motivo da correção' : 'Motivo da justificativa'}<textarea required maxLength={1000} rows={2} value={draft?.motivo ?? ''} disabled={operation.busy} onChange={(event) => setDrafts((old) => ({ ...old, [person.vinculoId]: { situacao: situation!, motivo: event.target.value } }))} /><span className="field-hint">Não inclua dados médicos ou outros detalhes pessoais.</span></label>}
        {!changed && person.frequencia?.motivo && <p className="field-hint attendance-wide">{person.frequencia.motivo}</p>}
      </article>;
    })}
    {!people.length && <p className="empty-state">Nenhum aluno com vínculo disponível para esta data.</p>}
    <footer className="attendance-save"><div role="status">{pending.length ? `${pending.length} ${pending.length === 1 ? 'alteração para salvar' : 'alterações para salvar'}` : 'Nenhuma alteração pendente'}</div><div className="attendance-save-actions"><Button type="submit" disabled={operation.busy || !pending.length}>{operation.busy ? 'Salvando…' : 'Salvar chamada'}</Button>{pending.length > 0 && <Button variant="outline" disabled={operation.busy} onClick={() => setDrafts({})}>Descartar alterações</Button>}{operation.error && <Button variant="outline" disabled={operation.busy} onClick={onReload}>Atualizar chamada</Button>}</div></footer>
  </form>;
}
