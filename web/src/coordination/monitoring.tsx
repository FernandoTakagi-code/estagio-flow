import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { User } from '../lib/types';
import { errorMessage, hours } from '../lib/utils';
import { Button } from '../components/ui/button';
import { SheetDetail } from '../components/sheet-detail';
import '../components/assessment.css';
interface Row { id: string; aluno: { nome: string }; disciplina: { nome: string; cargaHorariaTotal: number }; turma: string; professora: string; fichaId: string | null; fichaFechada: boolean; encerrado: boolean; minutosAprovados: number; pendentes: number; avaliacao: { media: string; aprovadoNaAvaliacao: boolean } | null }
export function Monitoring({ user, onBack }: { user: User; onBack: () => void }) {
  const [rows, setRows] = useState<Row[]>([]); const [page, setPage] = useState(1); const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [detail, setDetail] = useState<string | null>(null); const [search, setSearch] = useState('');
  useEffect(() => { const controller = new AbortController(); setLoading(true); setError(''); void api<{ vinculos: Row[] }>(`/frequencia/acompanhamento?pagina=${page}`, { signal: controller.signal }).then((r) => { if (!controller.signal.aborted) setRows(r.vinculos); }).catch((e: unknown) => { if (!controller.signal.aborted) setError(errorMessage(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [page, revision]);
  return <main className="content-width workspace monitoring"><Button variant="ghost" onClick={onBack}>Voltar à coordenação</Button><h1>Acompanhamento dos alunos</h1><p>Horas e avaliações por vínculo. O resultado de uma avaliação não declara a conclusão da disciplina.</p>
    <Button variant="ghost" disabled={loading} onClick={() => setRevision((n) => n + 1)}>Atualizar</Button>
    <label>Buscar nesta página<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Aluno ou disciplina" /></label>
    {error ? <p role="alert" className="form-error">{error}</p> : loading ? <p role="status">Carregando acompanhamento…</p> : <>
      {rows.filter((r) => (r.aluno.nome + ' ' + r.disciplina.nome).toLocaleLowerCase().includes(search.toLocaleLowerCase())).map((row) => <article className="monitoring-row" key={row.id}><h2>{row.aluno.nome}</h2><p>{row.disciplina.nome} · {row.turma} · {row.professora}</p><p>Horas aprovadas neste vínculo: <strong>{hours(row.minutosAprovados)}</strong> · Carga da disciplina: {row.disciplina.cargaHorariaTotal}h</p><p>Pendências: {row.pendentes} · {!row.fichaId ? 'Sem ficha' : row.fichaFechada ? 'Ficha fechada' : 'Ficha em andamento'} · {row.encerrado ? 'Vínculo encerrado' : 'Vínculo ativo'}</p><p>Avaliação: {row.avaliacao ? `média ${row.avaliacao.media.replace('.', ',')} · ${row.avaliacao.aprovadoNaAvaliacao ? 'atingiu o mínimo' : 'abaixo do mínimo'}` : 'ainda não publicada'}</p>{row.fichaId ? <Button variant="ghost" onClick={() => setDetail(row.fichaId)}>Ver ficha e avaliação</Button> : <p>Ainda sem registros de atividades.</p>}</article>)}
      {!rows.length && <p>Nenhum vínculo cadastrado.</p>}
    </>}
    <div className="pagination"><Button variant="ghost" disabled={loading || page === 1} onClick={() => setPage((n) => n - 1)}>Anterior</Button><span>Página {page}</span><Button variant="ghost" disabled={loading || rows.length < 50} onClick={() => setPage((n) => n + 1)}>Próxima</Button></div>
    {detail && <SheetDetail id={detail} user={user} onClose={() => setDetail(null)} onChanged={() => setRevision((n) => n + 1)} />}
  </main>;
}
