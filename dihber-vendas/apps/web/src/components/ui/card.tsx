import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-lg border border-slate-200 bg-white shadow-sm', className)}>{children}</div>;
}

export function CardTitulo({ children, acoes }: { children: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
      <h2 className="font-semibold text-slate-800">{children}</h2>
      {acoes}
    </div>
  );
}
