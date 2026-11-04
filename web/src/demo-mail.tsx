import { useEffect, useState } from 'react';
import { api } from './lib/api';
import { errorMessage } from './lib/utils';
import { Button } from './components/ui/button';
import { Modal } from './components/ui/modal';
interface Mail { id: string; to: string; subject: string; text: string }
export function DemoMail({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Mail[]>([]); const [error, setError] = useState(''); const [revision, setRevision] = useState(0);
  useEffect(() => { const controller = new AbortController(); void api<{ mensagens: Mail[] }>('/auth/demo-emails', { signal: controller.signal }).then((value) => setMessages(value.mensagens)).catch((cause: unknown) => { if (!controller.signal.aborted) setError(errorMessage(cause)); }); return () => controller.abort(); }, [revision]);
  return <Modal title="E-mails de demonstração" description="Caixa local fictícia. Nenhum e-mail foi enviado pela internet." onClose={onClose}><Button variant="outline" onClick={() => setRevision((old) => old + 1)}>Atualizar caixa</Button>{error && <p className="form-error" role="alert">{error}</p>}{messages.slice().reverse().map((message) => { const url = message.text.match(/http:\/\/127\.0\.0\.1:\d+\/#(?:convite|recuperacao)=[a-f0-9]{64}/)?.[0]; return <article className="demo-mail-item" key={message.id}><h3>{message.subject}</h3><p>Para: {message.to}</p><p>{message.text.split('\n\n')[0]}</p>{url && <a className="button button-outline" href={url} target="_blank" rel="noopener noreferrer">Abrir link de teste</a>}</article>; })}{!messages.length && <p className="muted">Nenhuma mensagem capturada. Solicite a recuperação de uma conta fictícia e atualize a caixa.</p>}</Modal>;
}
