import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { api } from './lib/api';
import type { User } from './lib/types';
import { errorMessage } from './lib/utils';
import { Brand } from './components/brand';
import { Button } from './components/ui/button';
import { LegalChoices, acknowledgement, useLegalDocuments } from './legal';
import { DemoMail } from './demo-mail';
type Mode = 'login' | 'invite' | 'forgot' | 'reset';
export function Auth({ onLogin, initialInvite, initialReset = '', notice }: { onLogin: (token: string, user: User, expiresIn: number) => void; initialInvite: string; initialReset?: string; notice: string }) {
  const [mode, setMode] = useState<Mode>(initialReset ? 'reset' : initialInvite ? 'invite' : 'login');
  const [inviteToken, setInviteToken] = useState(initialInvite); const [resetToken, setResetToken] = useState(initialReset);
  const [showPassword, setShowPassword] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [inbox, setInbox] = useState(false);
  const [options, setOptions] = useState({ recuperacaoDisponivel: false, caixaDemonstracao: false });
  const [checked, setChecked] = useState({ terms: false, privacy: false }); const { documents, error: documentsError, reload } = useLegalDocuments();
  useEffect(() => { const controller = new AbortController(); void api<typeof options>('/auth/opcoes', { signal: controller.signal }).then(setOptions).catch(() => {}); return () => controller.abort(); }, []);
  const defining = mode === 'invite' || mode === 'reset';
  function navigate(next: Mode) { if (busy) return; setMode(next); setError(''); setSuccess(''); setShowPassword(false); setChecked({ terms: false, privacy: false }); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    const form = new FormData(event.currentTarget); const senha = String(form.get('senha'));
    try {
      if (mode === 'forgot') { const response = await api<{ mensagem: string }>('/auth/recuperacao', { method: 'POST', body: { email: String(form.get('email')) } }); setSuccess(response.mensagem); }
      else if (defining) {
        if (senha !== form.get('confirmacao')) throw new Error('As senhas precisam ser iguais.');
        if (mode === 'invite' && !documents) throw new Error('Aguarde o carregamento dos documentos.');
        await api(mode === 'invite' ? '/auth/convites/aceitar' : '/auth/recuperacao/redefinir', { method: 'POST', body: { token: (mode === 'invite' ? inviteToken : resetToken).trim(), senha, ...(mode === 'invite' && documents?.exigido ? { documentos: acknowledgement(documents, checked) } : {}) } });
        setMode('login'); setInviteToken(''); setResetToken(''); setChecked({ terms: false, privacy: false }); setSuccess('Senha definida. Agora entre com seu e-mail e senha.');
      } else { const response = await api<{ accessToken: string; usuario: User; expiresIn: number }>('/auth/login', { method: 'POST', body: { email: String(form.get('email')), senha } }); onLogin(response.accessToken, response.usuario, response.expiresIn); }
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-visual"><Brand /><div className="auth-heading"><h1>Seu estágio.<br />Em um só lugar.</h1><p>Registre suas atividades.<br />Acompanhe cada etapa.</p></div><span className="auth-caption">Estágio Flow</span></section><section className="auth-form-region"><form className="auth-form" onSubmit={submit} key={mode}>
    <h2>{mode === 'invite' ? 'Defina sua senha' : mode === 'reset' ? 'Nova senha' : mode === 'forgot' ? 'Recuperar acesso' : 'Bem-vindo de volta'}</h2><p className="muted">{mode === 'invite' ? 'Use o convite enviado pela coordenação.' : mode === 'reset' ? 'Defina uma nova senha para sua conta.' : mode === 'forgot' ? 'Informe o e-mail cadastrado para receber as instruções.' : 'Entre com o e-mail cadastrado pela coordenação.'}</p>
    {notice && <p className="notice" role="status">{notice}</p>}{success && <p className="notice" role="status">{success}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    {mode === 'invite' ? <label>Código do convite<input required autoComplete="off" value={inviteToken} disabled={busy} onChange={(event) => setInviteToken(event.target.value)} maxLength={64} pattern="[a-f0-9]{64}" /></label> : mode === 'reset' ? <p className="field-hint">Use este formulário somente se você solicitou a recuperação.</p> : <label>E-mail<input name="email" type="email" autoComplete="username" disabled={busy} required maxLength={254} placeholder="seu@email.com" /></label>}
    {mode !== 'forgot' && <label>Senha<div className="password-field"><input name="senha" type={showPassword ? 'text' : 'password'} autoComplete={defining ? 'new-password' : 'current-password'} disabled={busy} required minLength={defining ? 12 : 1} maxLength={128} placeholder={defining ? 'Pelo menos 12 caracteres' : 'Sua senha'} /><Button variant="ghost" size="icon" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</Button></div></label>}
    {defining && <label>Confirme a senha<input name="confirmacao" type="password" autoComplete="new-password" disabled={busy} required minLength={12} maxLength={128} /></label>}
    {mode === 'invite' && documents?.exigido && <LegalChoices documents={documents} checked={checked} onChange={setChecked} disabled={busy} />}
    {mode === 'invite' && documentsError && <p className="form-error" role="alert">{documentsError}<Button variant="outline" onClick={() => { setChecked({ terms: false, privacy: false }); reload(); }}>Atualizar documentos</Button></p>}
    <Button type="submit" disabled={busy || (mode === 'invite' && (!documents || (documents.exigido && (!checked.terms || !checked.privacy))))} className="auth-submit">{busy ? 'Aguarde…' : defining ? 'Definir senha' : mode === 'forgot' ? 'Enviar instruções' : 'Entrar'}<ArrowRight size={18} /></Button>
    <div className="auth-secondary-actions">
      {mode === 'login' ? <><Button variant="ghost" disabled={busy} onClick={() => navigate('forgot')}>Esqueci minha senha</Button><Button variant="ghost" disabled={busy} onClick={() => navigate('invite')}>Recebi um convite</Button></> : <Button variant="ghost" disabled={busy} onClick={() => navigate('login')}>Voltar para o login</Button>}
    </div>
    {options.caixaDemonstracao && <div className="auth-demo-action"><Button variant="ghost" size="small" disabled={busy} onClick={() => setInbox(true)}>E-mails de demonstração</Button></div>}
    {mode === 'forgot' && !options.recuperacaoDisponivel && <p className="field-hint">O envio de e-mails pode estar indisponível. Nesse caso, fale com a coordenação.</p>}
    <p className="auth-help">Precisa de acesso? Fale com a coordenação.</p>
  </form></section>{inbox && <DemoMail onClose={() => setInbox(false)} />}</main>;
}
