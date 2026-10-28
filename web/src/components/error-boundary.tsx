import { Component, type ReactNode } from 'react';
import { Button } from './ui/button';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="empty-state" role="alert"><h1>Não foi possível exibir esta tela</h1><p>Recarregue para tentar novamente. Seus registros salvos continuam no sistema.</p><Button onClick={() => window.location.reload()}>Recarregar</Button></main>;
  }
}
