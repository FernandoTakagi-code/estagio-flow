import { Check, ChevronRight } from 'lucide-react';
import type { RecordItem, Sheet, Status } from '../lib/types';
import { dateLabel, hours, statusLabels } from '../lib/utils';
import { Button } from './ui/button';

export function StatusLabel({ status }: { status: Status }) { return <span className={`record-status status-${status}`}>{status === 'aprovado' ? <Check size={16} /> : <span className="status-dot" />}{statusLabels[status]}</span>; }
export function Records({ records, sheets, student, onOpen, selectable, selected, onSelect }: {
  records: RecordItem[]; sheets: Sheet[]; student: boolean; onOpen: (record: RecordItem) => void;
  selectable?: boolean; selected: string[]; onSelect: (record: RecordItem) => void;
}) {
  return <div className="records-table"><div className={`record-row record-head ${selectable ? 'with-selection' : ''}`} aria-hidden="true">{selectable && <span />}<span>Data</span><span>Atividade</span><span>Horário</span><span>Duração</span><span>Status</span><span /></div>
    {records.map((record) => {
      const sheet = sheets.find((item) => item.id === record.fichaId);
      return <div className={`record-row ${selectable ? 'with-selection' : ''}`} key={record.id}>
        {selectable && <div className="record-select">{record.status === 'enviado' && <input type="checkbox" aria-label={`Selecionar registro de ${record.data}: ${record.atividades}`} checked={selected.includes(record.id)} onChange={() => onSelect(record)} />}</div>}
        <span className="record-date">{dateLabel(record.data)}</span>
        <button className="record-activity" onClick={() => onOpen(record)}><span>{record.atividades}</span>{record.status === 'devolvido' && record.motivoDevolucao && <small className="record-return-reason">{record.motivoDevolucao}</small>}{!student && <small>{sheet?.vinculo.matricula.aluno.nome ?? 'Aluno'} · {sheet?.vinculo.estagio.disciplina.nome ?? 'Estágio'}</small>}</button>
        <span className="record-time">{record.horaInicio} – {record.horaFim}</span><span className="record-duration">{hours(record.duracaoMinutos)}</span><StatusLabel status={record.status} />
        <Button variant="ghost" size="small" className={student && record.status === 'devolvido' ? 'correction-action' : 'row-open'} onClick={() => onOpen(record)} aria-label={`${student && record.status === 'devolvido' ? 'Corrigir' : 'Ver'} registro de ${record.data}`}>{student && record.status === 'devolvido' ? 'Corrigir' : <ChevronRight size={18} />}</Button>
      </div>;
    })}
    {!records.length && <div className="empty-state"><h3>Nenhum registro por aqui</h3><p>{student ? 'Seus registros aparecerão aqui. Use Novo registro para começar.' : 'Os registros dos seus grupos aparecerão aqui quando forem enviados.'}</p></div>}
  </div>;
}
