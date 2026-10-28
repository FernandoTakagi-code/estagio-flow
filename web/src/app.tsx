import { useEffect, useState } from 'react';
import { Auth } from './auth';
import { Dashboard } from './dashboard';
import { api, setSession } from './lib/api';
import type { User } from './lib/types';
import { Coordination } from './coordination';

// Invitations use the fragment so their token is not sent in HTTP requests or referrers.
const initialInvite = new URLSearchParams(window.location.hash.slice(1)).get('convite') ?? '';
if (initialInvite) window.history.replaceState(null, '', window.location.pathname);

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [notice, setNotice] = useState('');
  function clear(message = '') { setSession(null); setUser(null); setNotice(message); }
  useEffect(() => {
    if (!user) return;
    const timeout = window.setTimeout(() => clear('Sua sessão expirou. Entre novamente.'), Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [user, expiresAt]);
  if (!user) return <Auth initialInvite={initialInvite} notice={notice} onLogin={(token, actor, expiresIn) => {
    setSession(token, () => clear('Sua sessão expirou. Entre novamente.'));
    setExpiresAt(Date.now() + expiresIn * 1000); setNotice(''); setUser(actor);
  }} />;
  const logout = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } finally { clear(); }
  };
  return user.perfil === 'coordenacao' ? <Coordination user={user} onLogout={logout} /> : <Dashboard key={user.id} user={user} onLogout={logout} />;
}
