import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export function Tabela({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, ...p }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn('border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap', className)}
      {...p}
    />
  );
}

export function Td({ className, ...p }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('border-b border-slate-100 px-4 py-2.5', className)} {...p} />;
}

export function LinhaVazia({ colunas, carregando, mensagem = 'Nenhum registro encontrado' }: { colunas: number; carregando?: boolean; mensagem?: string }) {
  return (
    <tr>
      <td colSpan={colunas} className="px-4 py-10 text-center text-slate-500">
        {carregando ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : mensagem}
      </td>
    </tr>
  );
}

export function Paginacao({
  pagina,
  porPagina,
  total,
  aoMudar,
}: {
  pagina: number;
  porPagina: number;
  total: number;
  aoMudar: (p: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const de = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const ate = Math.min(total, pagina * porPagina);
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm text-slate-600">
      <span>
        {de}–{ate} de {total.toLocaleString('pt-BR')}
      </span>
      <div className="flex items-center gap-1">
        <Button variante="secundario" tamanho="icone" disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)} aria-label="Página anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2">
          {pagina} / {paginas}
        </span>
        <Button variante="secundario" tamanho="icone" disabled={pagina >= paginas} onClick={() => aoMudar(pagina + 1)} aria-label="Próxima página">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
