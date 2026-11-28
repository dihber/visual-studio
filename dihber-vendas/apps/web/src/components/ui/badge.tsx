import type { ReactNode } from 'react';
import { STATUS_PEDIDO_LABEL, type StatusPedido } from '@dihber/shared';
import { cn } from '@/lib/utils';

const cores = {
  cinza: 'bg-slate-100 text-slate-700 ring-slate-200',
  amarelo: 'bg-amber-50 text-amber-800 ring-amber-200',
  verde: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  vermelho: 'bg-red-50 text-red-700 ring-red-200',
  azul: 'bg-blue-50 text-blue-700 ring-blue-200',
} as const;

export function Badge({
  cor = 'cinza',
  children,
}: {
  cor?: keyof typeof cores;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        cores[cor],
      )}
    >
      {children}
    </span>
  );
}

const corStatus: Record<StatusPedido, keyof typeof cores> = {
  PENDENTE: 'amarelo',
  APROVADO: 'verde',
  REPROVADO: 'vermelho',
  CANCELADO: 'cinza',
  FATURADO: 'azul',
};

export function BadgeStatus({ status }: { status: StatusPedido }) {
  return (
    <Badge cor={corStatus[status]}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_PEDIDO_LABEL[status]}
    </Badge>
  );
}

export function BadgeAtivo({ ativo }: { ativo: boolean }) {
  return <Badge cor={ativo ? 'verde' : 'cinza'}>{ativo ? 'Ativo' : 'Inativo'}</Badge>;
}
