import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './button';

export function Modal({ title, description, children, onClose }: { title: string; description: string; children: ReactNode; onClose: () => void }) {
  return <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}><Dialog.Portal>
    <Dialog.Overlay className="modal-overlay" />
    <Dialog.Content className="modal-content" onOpenAutoFocus={(event) => {
      // Start at the heading so a long form's beginning stays visible on mobile.
      event.preventDefault(); document.getElementById('modal-title')?.focus();
    }}>
      <header className="modal-header"><div><Dialog.Title id="modal-title" tabIndex={-1}>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description></div><Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Fechar"><X size={20} /></Button></Dialog.Close></header>
      {children}
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
