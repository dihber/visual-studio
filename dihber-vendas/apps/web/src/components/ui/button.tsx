import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const variantes = {
  primario: 'bg-primary text-white hover:bg-primary-hover shadow-sm',
  secundario: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm',
  perigo: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  sucesso: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
  fantasma: 'text-slate-600 hover:bg-slate-100',
} as const;

const tamanhos = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm', icone: 'h-8 w-8' } as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: keyof typeof variantes;
  tamanho?: keyof typeof tamanhos;
  carregando?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variante = 'primario', tamanho = 'md', carregando, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || carregando}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
        variantes[variante],
        tamanhos[tamanho],
        className,
      )}
      {...props}
    >
      {carregando && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
