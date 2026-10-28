import type { ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const variants = cva('button inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-50', {
  variants: { variant: { default: 'button-primary', light: 'button-light', ghost: 'button-ghost', danger: 'button-danger' }, size: { default: 'button-default', small: 'button-small', icon: 'button-icon' } },
  defaultVariants: { variant: 'default', size: 'default' },
});
export function Button({ className, variant, size, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variants>) {
  return <button type={type} className={cn(variants({ variant, size }), className)} {...props} />;
}
