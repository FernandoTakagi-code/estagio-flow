import { useState, type ReactNode } from 'react';
import { errorMessage } from '../lib/utils';
import { Button } from '../components/ui/button';
import type { Invitation } from './types';

export function useOperation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(task: () => Promise<void>) {
    setBusy(true); setError('');
    try { await task(); } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  return { busy, error, run, setError };
}
export function Feedback({ error, children }: { error: string; children?: ReactNode }) {
  return <>{error && <p className="form-error" role="alert">{error}</p>}{children}</>;
}
export function InvitationList({ invitations }: { invitations: Invitation[] }) {
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');
  return <section className="invitation-list"><h3>Convites de acesso</h3><p className="muted">Guarde os links antes de fechar. Eles não serão exibidos novamente. Compartilhe cada convite somente com a pessoa indicada; o envio por e-mail ainda é manual.</p>
    {invitations.map((item) => {
      const link = `${window.location.origin}/#convite=${item.convite.token}`;
      return <article className="invitation-item" key={item.email}><strong>{item.nome}</strong><p>{item.email}</p><p className="field-hint">Válido até {new Date(item.convite.expiraEm).toLocaleString('pt-BR')}</p><label>Link do convite<input readOnly value={link} onFocus={(event) => event.currentTarget.select()} /></label><Button variant="ghost" size="small" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(item.email); setError(''); } catch { setError('Não foi possível copiar. Selecione o link acima e copie manualmente.'); } }}>{copied === item.email ? 'Copiado' : 'Copiar convite'}</Button></article>;
    })}{error && <p role="alert" className="form-error">{error}</p>}
  </section>;
}
export function Search({ value, onChange, label = 'Buscar por nome ou e-mail' }: { value: string; onChange: (value: string) => void; label?: string }) {
  return <label className="coord-search">{label}<input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={label} /></label>;
}
export const matches = (text: string, query: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim());
