import { hours } from '../lib/utils';

export function ProgressRing({ value, total, student }: { value: number; total: number; student: boolean }) {
  const percentage = total ? Math.min(100, Math.round(value / total * 100)) : 0;
  const length = 2 * Math.PI * 145;
  return <div className="progress-ring" role="img" aria-label={`${student ? 'Horas aprovadas' : 'Registros aprovados'}: ${student ? hours(value) : value} de ${student ? hours(total) : total}, ${percentage}%`}>
    <svg viewBox="0 0 320 320" aria-hidden="true"><circle className="ring-track" cx="160" cy="160" r="145" /><circle className="ring-value" cx="160" cy="160" r="145" strokeDasharray={`${length} ${length}`} strokeDashoffset={length * (1 - percentage / 100)} style={{ opacity: percentage ? 1 : 0 }} /></svg>
    <div className="ring-copy"><span>{student ? 'Horas aprovadas' : 'Registros aprovados'}</span><strong>{student ? hours(value) : value}</strong><span>{student ? `de ${hours(total)} nos seus vínculos` : `de ${total} registros`}</span><small>{percentage}%</small></div>
  </div>;
}
