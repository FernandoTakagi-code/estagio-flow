import { useEffect, useState } from 'react';
import { Auth } from './auth';
import { Dashboard } from './dashboard';
import { api, setSession, setLegalRequiredHandler } from './lib/api';
import type { User } from './lib/types';
import { Coordination } from './coordination';
import { LegalFooter, LegalGate } from './legal';
import { Button } from './components/ui/button';
import { errorMessage } from './lib/utils';
// Access tokens in the fragment never enter HTTP requests or referrers.
const fragment = new URLSearchParams(window.location.hash.slice(1));
let initialInvite = fragment.get('convite') ?? ''; let initialReset = fragment.get('recuperacao') ?? '';
if (initialInvite || initialReset) window.history.replaceState(null, '', window.location.pathname);
export function App() {
  const [user, setUser] = useState<User | null>(null); const [expiresAt, setExpiresAt] = useState(0); const [notice, setNotice] = useState('');
  const [legalPending, setLegalPending] = useState<boolean | null>(null); const [legalError, setLegalError] = useState(''); const [revision, setRevision] = useState(0);
  function clear(message = '') { setSession(null); setUser(null); setLegalPending(null); setNotice(message); }
  useEffect(() => { setLegalRequiredHandler(() => setLegalPending(true)); }, []);
  useEffect(() => {
    if (!user) return;
    const timeout = window.setTimeout(() => clear('Sua sessão expirou. Entre novamente.'), Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [user, expiresAt]);
  useEffect(() => { if (!user) return; const controller = new AbortController(); setLegalError(''); void api<{ pendente: boolean }>('/legal/status', { signal: controller.signal }).then((value) => setLegalPending(value.pendente)).catch((cause: unknown) => { if (!controller.signal.aborted) setLegalError(errorMessage(cause)); }); return () => controller.abort(); }, [user, revision]);
  const logout = async () => { try { await api('/auth/logout', { method: 'POST' }); } finally { clear(); } };
  if (!user) return <><Auth initialInvite={initialInvite} initialReset={initialReset} notice={notice} onLogin={(token, actor, expiresIn) => { initialInvite = ''; initialReset = ''; setSession(token, () => clear('Sua sessão expirou. Entre novamente.')); setExpiresAt(Date.now() + expiresIn * 1000); setNotice(''); setLegalPending(null); setUser(actor); }} /></>;
  if (legalPending === null) return <main className="legal-gate">{legalError ? <p role="alert">{legalError}<Button onClick={() => setRevision((old) => old + 1)}>Tentar novamente</Button><Button variant="outline" onClick={() => void logout()}>Sair</Button></p> : <p role="status">Verificando documentos de uso…</p>}</main>;
  if (legalPending) return <LegalGate onAccepted={() => setLegalPending(false)} onLogout={logout} />;
  return <>{user.perfil === 'coordenacao' ? <Coordination user={user} onLogout={logout} /> : <Dashboard key={user.id} user={user} onLogout={logout} />}<LegalFooter /></>;
}
