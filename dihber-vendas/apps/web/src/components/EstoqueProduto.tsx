import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatarDataHora, formatarQuantidade } from '@dihber/shared';
import { http } from '@/api/cliente';
import type { Produto, ReservasProduto } from '@/api/tipos';
import { Dialog } from './ui/dialog';
import { BadgeStatus } from './ui/badge';
import { LinhaVazia, Tabela, Td, Th } from './ui/table';
import { cn } from '@/lib/utils';

/** Célula do estoque na lista de produtos: mostra o disponível e abre o detalhe do saldo. */
export function CelulaEstoque({ produto: p }: { produto: Produto }) {
  const [aberto, setAberto] = useState(false);
  if (p.estoque === null)
    return (
      <span className="text-slate-400" title="Sem controle de estoque">
        -
      </span>
    );
  const disp = p.estoqueDisponivel ?? 0;
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="rounded px-1.5 py-0.5 text-right hover:bg-blue-50"
        title="Ver saldo total, reservado e disponível"
      >
        <span
          className={cn(
            'font-medium underline decoration-dotted underline-offset-4',
            disp <= 0 && 'text-red-600',
          )}
        >
          {formatarQuantidade(disp)}
        </span>
        {p.estoqueReservado > 0 && (
          <span className="block text-xs text-slate-500">de {formatarQuantidade(p.estoque)}</span>
        )}
      </button>
      {aberto && <DialogEstoque produto={p} aoFechar={() => setAberto(false)} />}
    </>
  );
}

function DialogEstoque({ produto, aoFechar }: { produto: Produto; aoFechar: () => void }) {
  const [verReservas, setVerReservas] = useState(false);
  const q = useQuery({
    queryKey: ['/produtos', produto.id, 'reservas'],
    queryFn: () => http.get<ReservasProduto>(`/produtos/${produto.id}/reservas`),
  });
  const d = q.data;
  const total = d?.estoque ?? produto.estoque ?? 0;
  const reservado = d?.reservado ?? produto.estoqueReservado;
  const disponivel = d?.disponivel ?? produto.estoqueDisponivel ?? 0;

  return (
    <Dialog
      aberto
      aoFechar={aoFechar}
      titulo={`Estoque — ${produto.codigo} ${produto.descricao}`}
      largura="max-w-4xl"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Saldo titulo="Saldo total" valor={total} />
          <button
            type="button"
            onClick={() => setVerReservas((v) => !v)}
            className={cn(
              'rounded-lg border p-3 text-left transition-colors',
              verReservas
                ? 'border-amber-400 bg-amber-50'
                : 'border-amber-200 bg-amber-50/60 hover:bg-amber-50',
            )}
            aria-expanded={verReservas}
          >
            <p className="flex items-center justify-between text-xs font-medium text-amber-800">
              Reservado{' '}
              {verReservas ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </p>
            <p className="text-2xl font-semibold text-amber-900">{formatarQuantidade(reservado)}</p>
            <p className="text-xs text-amber-700">Clique para ver os pedidos</p>
          </button>
          <Saldo titulo="Disponível para vender" valor={disponivel} destaque />
        </div>
        <p className="text-xs text-slate-500">
          Quantidades em unidades (UN). Reservam estoque os pedidos pendentes e aprovados; reprovar
          ou cancelar libera o saldo. A baixa do saldo total acontece ao faturar.
        </p>

        {verReservas && (
          <div className="max-h-[45vh] overflow-y-auto rounded-md border border-slate-200">
            <Tabela>
              <thead>
                <tr>
                  <Th>Pedido</Th>
                  <Th>Data</Th>
                  <Th>Cliente</Th>
                  <Th>Vendedor</Th>
                  <Th className="text-right">Qtd</Th>
                  <Th className="text-right">Reservado (UN)</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {!d?.pedidos.length ? (
                  <LinhaVazia
                    colunas={7}
                    carregando={q.isLoading}
                    mensagem="Nenhum pedido reservando este produto"
                  />
                ) : (
                  d.pedidos.map((r) => (
                    <tr key={r.pedido.id}>
                      <Td>
                        <Link
                          to={`/pedidos/${r.pedido.id}`}
                          className="font-mono font-medium text-primary hover:underline"
                        >
                          {r.pedido.numero}
                        </Link>
                      </Td>
                      <Td className="whitespace-nowrap">
                        {formatarDataHora(r.pedido.criadoNoAppEm)}
                      </Td>
                      <Td>{r.pedido.cliente.nomeFantasia || r.pedido.cliente.razaoSocial}</Td>
                      <Td>{r.pedido.vendedor.nome}</Td>
                      <Td className="whitespace-nowrap text-right">
                        {formatarQuantidade(r.quantidade)} {r.tipoEmbalagem}
                      </Td>
                      <Td className="text-right font-medium">
                        {formatarQuantidade(r.qtdUnidades)}
                      </Td>
                      <Td>
                        <BadgeStatus status={r.pedido.status} />
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Tabela>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function Saldo({ titulo, valor, destaque }: { titulo: string; valor: number; destaque?: boolean }) {
  const negativo = valor < 0;
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        destaque
          ? valor <= 0
            ? 'border-red-200 bg-red-50'
            : 'border-emerald-200 bg-emerald-50'
          : 'border-slate-200 bg-white',
      )}
    >
      <p className="text-xs font-medium text-slate-600">{titulo}</p>
      <p
        className={cn(
          'text-2xl font-semibold',
          destaque && (valor <= 0 ? 'text-red-700' : 'text-emerald-800'),
          negativo && 'text-red-700',
        )}
      >
        {formatarQuantidade(valor)}
      </p>
    </div>
  );
}
