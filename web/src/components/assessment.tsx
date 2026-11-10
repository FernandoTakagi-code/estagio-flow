import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { User } from '../lib/types';
import { errorMessage } from '../lib/utils';
import { Button } from './ui/button';
import './assessment.css';

interface Evaluation { id: string; versao: number; notas: string[]; media: string; aprovadoNaAvaliacao: boolean; motivo: string | null; criadoEm: string; snapshot: { professora: { nome: string; coren: string } } }
interface Data { criterios: string[]; vigente: Evaluation | null; historico: Evaluation[] }
export function Assessment({ id, user, onChanged }: { id: string; user: User; onChanged: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [notas, setNotas] = useState<string[]>(Array(9).fill(''));
  const [editing, setEditing] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  async function load(signal?: AbortSignal) {
    const response = await api<Data>(`/frequencia/fichas/${id}/avaliacao`, { signal });
    if (signal?.aborted) return;
    setData(response); setNotas(response.vigente?.notas ?? Array(9).fill('')); setEditing(!response.vigente);
    setConfirmed(false); setMotivo(''); setPage(1); setMore(response.historico.length === 20);
  }
  useEffect(() => { const controller = new AbortController(); void load(controller.signal).catch((cause: unknown) => { if (!controller.signal.aborted) setError(errorMessage(cause)); }); return () => controller.abort(); }, [id]);
  async function publish() {
    if (!data || !confirmed || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/frequencia/fichas/${id}/avaliacao`, { method: 'POST', body: { notas: notas.map((n) => n.replace(',', '.')), versaoAnterior: data.vigente?.versao ?? 0, confirmar: true, ...(data.vigente ? { motivo } : {}) } });
      await load(); onChanged(); setNotice('Avaliação publicada. O aluno e a coordenação já podem consultar.');
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  return <section className="assessment"><h3>Avaliação de estágio</h3>
    <p className="field-hint">Uma avaliação por vínculo. A média das nove notas não substitui o cumprimento das horas nem o fechamento da ficha.</p>
    {error && <p className="form-error" role="alert">{error}<Button variant="ghost" disabled={busy} onClick={() => { if (!editing || window.confirm('Atualizar descarta as notas ainda não publicadas. Continuar?')) { setError(''); void load().catch((cause: unknown) => setError(errorMessage(cause))); } }}>Atualizar avaliação</Button></p>}
    {notice && <p role="status" className="notice">{notice}</p>}
    {!data ? <p role="status">Carregando avaliação…</p> : <>
      {data.vigente && <div className="notice"><strong>Média: {data.vigente.media.replace('.', ',')} · {data.vigente.aprovadoNaAvaliacao ? 'Atingiu a média mínima' : 'Abaixo da média mínima'}</strong><p>Versão {data.vigente.versao} · {data.vigente.snapshot.professora.nome} · {data.vigente.snapshot.professora.coren}</p><p className="field-hint">O resultado considera a média antes do arredondamento para exibição.</p></div>}
      {user.perfil === 'professora' && editing ? <form onSubmit={(event) => { event.preventDefault(); void publish(); }}>
        <fieldset disabled={busy}><legend>Notas de 0 a 10</legend>{data.criterios.map((label, index) => <label className="assessment-grade" key={label}><span>{index + 1}. {label}</span><input aria-label={label} type="number" min="0" max="10" step="0.01" required value={notas[index]} onChange={(event) => { setConfirmed(false); setNotas((old) => old.map((n, i) => i === index ? event.target.value : n)); }} /></label>)}
          {data.vigente && <label>Motivo da correção<textarea required maxLength={1000} value={motivo} onChange={(event) => { setConfirmed(false); setMotivo(event.target.value); }} /></label>}
          <p className="field-hint">Média mínima 7,0, calculada antes do arredondamento. As notas só são salvas ao publicar.</p>
          <label className="assessment-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />Conferi as nove notas e confirmo a publicação.</label>
          <Button type="submit" disabled={!confirmed || !user.coren || (Boolean(data.vigente) && !motivo.trim())}>{busy ? 'Publicando…' : 'Publicar avaliação'}</Button>
          {!user.coren && <p className="form-error">Cadastre seu COREN para publicar.</p>}
          {data.vigente && <Button variant="ghost" onClick={() => { setEditing(false); setConfirmed(false); }}>Cancelar correção</Button>}
        </fieldset>
      </form> : data.vigente ? <><ol>{data.criterios.map((label, index) => <li key={label}>{label}: <strong>{data.vigente!.notas[index]?.replace('.', ',')}</strong></li>)}</ol>{user.perfil === 'professora' && <Button variant="ghost" onClick={() => { setNotas(data.vigente!.notas); setEditing(true); setConfirmed(false); setNotice(''); }}>Corrigir avaliação</Button>}</> : <p>Avaliação ainda não publicada.</p>}
      {data.historico.length > 0 && <details><summary>Histórico de avaliações</summary>{data.historico.map((item) => <article key={item.id}><strong>Versão {item.versao} · Média {item.media.replace('.', ',')}</strong><p>{new Date(item.criadoEm).toLocaleString('pt-BR')} · {item.snapshot.professora.nome}</p>{item.motivo && <p>Motivo: {item.motivo}</p>}<p>Notas: {item.notas.join(' / ')}</p></article>)}{more && <Button variant="ghost" disabled={busy} onClick={async () => { setBusy(true); try { const result = await api<Data>(`/frequencia/fichas/${id}/avaliacao?pagina=${page + 1}`); setData((old) => old ? { ...old, historico: [...old.historico, ...result.historico] } : old); setPage(page + 1); setMore(result.historico.length === 20); } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); } }}>Mais versões</Button>}</details>}
    </>}
  </section>;
}
