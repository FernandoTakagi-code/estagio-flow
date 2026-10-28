import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { api } from './lib/api';
import type { User } from './lib/types';
import { errorMessage } from './lib/utils';
import { Brand } from './components/brand';
import { Button } from './components/ui/button';

export function Auth({ onLogin, initialInvite, notice }: { onLogin: (token: string, user: User, expiresIn: number) => void; initialInvite: string; notice: string }) {
  const [invite, setInvite] = useState(Boolean(initialInvite));
  const [inviteToken, setInviteToken] = useState(initialInvite);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    const form = new FormData(event.currentTarget);
    const senha = String(form.get('senha'));
    try {
      if (invite) {
        if (senha !== form.get('confirmacao')) throw new Error('As senhas precisam ser iguais.');
        await api('/auth/convites/aceitar', { method: 'POST', body: { token: inviteToken.trim(), senha } });
        setInvite(false); setInviteToken(''); setSuccess('Senha definida. Agora entre com seu e-mail e senha.');
      } else {
        const response = await api<{ accessToken: string; usuario: User; expiresIn: number }>('/auth/login', { method: 'POST', body: { email: String(form.get('email')), senha } });
        onLogin(response.accessToken, response.usuario, response.expiresIn);
      }
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  return <main className="auth-page">
    <section className="auth-visual"><Brand /><div className="auth-heading"><h1>Seu estágio.<br />Em um só lugar.</h1><p>Registre suas atividades.<br />Acompanhe cada etapa.</p></div><span className="auth-caption">Estágio Flow</span></section>
    <section className="auth-form-region"><form className="auth-form" onSubmit={submit} key={invite ? 'invite' : 'login'}>
      <h2>{invite ? 'Defina sua senha' : 'Bem-vindo de volta'}</h2><p className="muted">{invite ? 'Use o convite enviado pela coordenação.' : 'Entre com o e-mail cadastrado pela coordenação.'}</p>
      {notice && <p className="notice" role="status">{notice}</p>}{success && <p className="notice" role="status">{success}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {invite ? <label>Código do convite<input required autoComplete="off" value={inviteToken} onChange={(event) => setInviteToken(event.target.value)} maxLength={64} pattern="[a-f0-9]{64}" /></label> : <label>E-mail<input name="email" type="email" autoComplete="username" required maxLength={254} placeholder="seu@email.com" /></label>}
      <label>Senha<div className="password-field"><input name="senha" type={showPassword ? 'text' : 'password'} autoComplete={invite ? 'new-password' : 'current-password'} required minLength={invite ? 12 : 1} maxLength={128} placeholder={invite ? 'Pelo menos 12 caracteres' : 'Sua senha'} /><Button variant="ghost" size="icon" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</Button></div></label>
      {invite && <label>Confirme a senha<input name="confirmacao" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>}
      <Button type="submit" disabled={busy} className="auth-submit">{busy ? 'Aguarde…' : invite ? 'Definir senha' : 'Entrar'}<ArrowRight size={18} /></Button>
      <Button variant="ghost" disabled={busy} onClick={() => { setInvite(!invite); setError(''); setSuccess(''); }}>{invite ? 'Voltar para o login' : 'Recebi um convite'}</Button>
      <p className="auth-help">Precisa de acesso? Fale com a coordenação.</p>
    </form></section>
  </main>;
}
