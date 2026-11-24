import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Dialog({
  aberto,
  aoFechar,
  titulo,
  children,
  rodape,
  largura = 'max-w-lg',
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: string;
}) {
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [aberto, aoFechar]);

  if (!aberto) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[8vh]"
      onMouseDown={aoFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn('w-full rounded-lg bg-white shadow-xl', largura)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button
            onClick={aoFechar}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {rodape && (
          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 rounded-b-lg">
            {rodape}
          </div>
        )}
      </div>
    </div>
  );
}
