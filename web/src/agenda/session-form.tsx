import { api } from '../lib/api';
import { today } from '../lib/utils';
import type { Stage } from '../lib/types';
import { Modal } from '../components/ui/modal';
import { Button } from '../components/ui/button';
import { useOperation, Feedback } from '../coordination/shared';
import type { Session } from './types';

export function SessionForm({ groups, initial, onClose, onSaved }: { groups: Stage[]; initial?: Session; onClose: () => void; onSaved: () => void }) {
  const operation = useOperation(); const options = groups.filter((group) => !group.encerradoEm);
  return <Modal title={initial ? 'Alterar sessão' : 'Nova sessão'} description="Organize os dias e horários regulares do grupo de estágio." onClose={() => { if (!operation.busy) onClose(); }}><Feedback error={operation.error} />
    <form className="record-form" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      void operation.run(async () => { await api(initial ? `/agenda/sessoes/${initial.id}` : '/agenda/sessoes', { method: initial ? 'PUT' : 'POST', body: { data: form.get('data'), horaInicio: form.get('horaInicio'), horaFim: form.get('horaFim'), ...(initial ? { versao: initial.versao, motivo: form.get('motivo') } : { estagioId: form.get('estagioId') }) } }); onSaved(); onClose(); });
    }}>
      {!initial && <label>Grupo<select name="estagioId" required defaultValue=""><option value="">Selecione</option>{options.map((group) => <option key={group.id} value={group.id}>{group.codigo} · {group.disciplina.nome}</option>)}</select></label>}
      <label>Data<input name="data" type="date" required defaultValue={initial?.data ?? today()} /></label>
      <div className="field-pair"><label>Entrada<input name="horaInicio" type="time" required defaultValue={initial?.horaInicio ?? '07:00'} /></label><label>Saída<input name="horaFim" type="time" required defaultValue={initial?.horaFim ?? '13:00'} /></label></div>
      {initial && <label>Motivo da alteração<textarea name="motivo" required maxLength={1000} rows={3} /></label>}
      <div className="form-actions"><Button disabled={operation.busy || (!initial && !options.length)} type="submit">{operation.busy ? 'Salvando…' : 'Salvar sessão'}</Button></div>
    </form>
  </Modal>;
}
