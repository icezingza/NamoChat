import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const baseFieldClasses =
  'w-full rounded-xl border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-zinc-100 ' +
  'placeholder:text-zinc-500 outline-none transition-colors focus:border-accent-500';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(baseFieldClasses, className)} {...props} />
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(baseFieldClasses, 'resize-none', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export const Label = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <label className={cn('mb-1 block text-xs font-medium text-zinc-400', className)}>{children}</label>
);
