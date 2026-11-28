import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { formatarData, formatarMoeda, formatarQuantidade } from '@dihber/shared';
import { http } from '@/api/cliente';
import type { ItemComissao, RelatorioComissoes } from '@/api/tipos';
import { useAuth } from '@/hooks/useAuth';
import { useOpcoes } from '@/hooks/useOpcoes';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { BadgeStatus } from '@/components/ui/badge';
import { Alerta } from '@/components/ui/alerta';
import { LinhaVazia, Tabela, Td, Th } from '@/components/ui/table';
import { hojeISO } from '@/lib/utils';

const nomeMes = (aaaamm: string) => {
  const [a, m] = aaaamm.split('-').map(Number);
  const t = new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function Comissoes() {
  const { usuario } = useAuth();
  const [mes, setMes] = useState(hojeISO().slice(0, 7));
  const [vendedorId, setVendedorId] = useState('');
  const [detalheDe, setDetalheDe] = useState<{ id: string; nome: string } | null>(null);
  const vendedores = useOpcoes('/vendedores');

  const q = useQuery({
    queryKey: ['/comissoes/mensal', mes, vendedorId],
    queryFn: () =>
      http.get<RelatorioComissoes>('/comissoes/mensal', { competencia: mes, vendedorId }),
    enabled: /^\d{4}-\d{2}$/.test(mes),
  });
  const r = q.data;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Comissões</h1>
        <p className="text-sm text-slate-500">
          Faturamento e comissão por vendedor no mês do pedido
          {usuario?.supervisor && ` · Equipe de ${usuario.supervisor.nome}`}
        </p>
      </div>

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Mês</span>
          <Input
            type="month"
            className="w-48"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Vendedor</span>
          <Select
            className="w-64"
            value={vendedorId}
            onChange={(e) => setVendedorId(e.target.value)}
          >
            <option value="">Todos os vendedores</option>
            {vendedores.todasOpcoes.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
      </Card>

      <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong>Faturamento e comissão</strong> contam só pedidos <strong>faturados</strong>. A
          coluna <strong>Previsão</strong> mostra os pedidos aprovados que ainda não foram
          faturados. A comissão de cada item usa o % do produto no dia em que o pedido foi feito.
        </p>
      </div>

      {q.error && <Alerta>{q.error.message}</Alerta>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Resumo
          titulo={`Faturamento — ${nomeMes(mes)}`}
          valor={r ? formatarMoeda(r.total.faturado.faturamento) : '—'}
          detalhe={r ? `${r.total.faturado.pedidos} pedido(s) faturado(s)` : ''}
        />
        <Resumo
          titulo="Comissão a pagar"
          valor={r ? formatarMoeda(r.total.faturado.comissao) : '—'}
          destaque
        />
        <Resumo
          titulo="Previsão (aprovados a faturar)"
          valor={r ? formatarMoeda(r.total.previsao.faturamento) : '—'}
          detalhe={r ? `Comissão prevista: ${formatarMoeda(r.total.previsao.comissao)}` : ''}
        />
      </div>

      <Card>
        <Tabela>
          <thead>
            <tr>
              <Th>Vendedor</Th>
              <Th className="text-right">Pedidos faturados</Th>
              <Th className="text-right">Faturamento</Th>
              <Th className="text-right">Comissão</Th>
              <Th className="text-right">Previsão: faturamento</Th>
              <Th className="text-right">Previsão: comissão</Th>
            </tr>
          </thead>
          <tbody>
            {!r?.vendedores.length ? (
              <LinhaVazia
                colunas={6}
                carregando={q.isLoading}
                mensagem="Nenhuma venda faturada ou aprovada neste mês"
              />
            ) : (
              <>
                {r.vendedores.map((v) => (
                  <tr key={v.vendedor.id} className="hover:bg-slate-50">
                    <Td>
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline"
                        onClick={() => setDetalheDe({ id: v.vendedor.id, nome: v.vendedor.nome })}
                      >
                        {v.vendedor.codigo} - {v.vendedor.nome}
                      </button>
                    </Td>
                    <Td className="text-right">{v.faturado.pedidos}</Td>
                    <Td className="whitespace-nowrap text-right">
                      {formatarMoeda(v.faturado.faturamento)}
                    </Td>
                    <Td className="whitespace-nowrap text-right font-semibold">
                      {formatarMoeda(v.faturado.comissao)}
                    </Td>
                    <Td className="whitespace-nowrap text-right text-slate-500">
                      {formatarMoeda(v.previsao.faturamento)}
                    </Td>
                    <Td className="whitespace-nowrap text-right text-slate-500">
                      {formatarMoeda(v.previsao.comissao)}
                    </Td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <Td>Total</Td>
                  <Td className="text-right">{r.total.faturado.pedidos}</Td>
                  <Td className="whitespace-nowrap text-right">
                    {formatarMoeda(r.total.faturado.faturamento)}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    {formatarMoeda(r.total.faturado.comissao)}
                  </Td>
                  <Td className="whitespace-nowrap text-right text-slate-500">
                    {formatarMoeda(r.total.previsao.faturamento)}
                  </Td>
                  <Td className="whitespace-nowrap text-right text-slate-500">
                    {formatarMoeda(r.total.previsao.comissao)}
                  </Td>
                </tr>
              </>
            )}
          </tbody>
        </Tabela>
      </Card>

      {detalheDe && (
        <DialogDetalhe mes={mes} vendedor={detalheDe} aoFechar={() => setDetalheDe(null)} />
      )}
    </div>
  );
}

function Resumo({
  titulo,
  valor,
  detalhe,
  destaque,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  destaque?: boolean;
}) {
  return (
    <Card className={destaque ? 'border-emerald-200 bg-emerald-50 p-4' : 'p-4'}>
      <p className="text-xs font-medium text-slate-500">{titulo}</p>
      <p className={`text-2xl font-semibold ${destaque ? 'text-emerald-800' : ''}`}>{valor}</p>
      {detalhe && <p className="text-xs text-slate-500">{detalhe}</p>}
    </Card>
  );
}

function DialogDetalhe({
  mes,
  vendedor,
  aoFechar,
}: {
  mes: string;
  vendedor: { id: string; nome: string };
  aoFechar: () => void;
}) {
  const q = useQuery({
    queryKey: ['/comissoes/detalhe', mes, vendedor.id],
    queryFn: () =>
      http.get<ItemComissao[]>('/comissoes/detalhe', { competencia: mes, vendedorId: vendedor.id }),
  });
  const itens = q.data ?? [];
  return (
    <Dialog
      aberto
      aoFechar={aoFechar}
      titulo={`${vendedor.nome} — ${nomeMes(mes)}`}
      largura="max-w-5xl"
    >
      <div className="max-h-[60vh] overflow-y-auto">
        <Tabela>
          <thead>
            <tr>
              <Th>Pedido</Th>
              <Th>Data</Th>
              <Th>Cliente</Th>
              <Th>Produto</Th>
              <Th className="text-right">Qtd</Th>
              <Th className="text-right">Valor vendido</Th>
              <Th className="text-right">%</Th>
              <Th className="text-right">Comissão</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 ? (
              <LinhaVazia colunas={9} carregando={q.isLoading} mensagem="Nenhum item" />
            ) : (
              itens.map((i, k) => (
                <tr key={k} className={i.pedido.status === 'FATURADO' ? '' : 'text-slate-500'}>
                  <Td>
                    <Link
                      to={`/pedidos/${i.pedido.id}`}
                      className="font-mono text-primary hover:underline"
                    >
                      {i.pedido.numero}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap">{formatarData(i.pedido.criadoNoAppEm)}</Td>
                  <Td>{i.pedido.cliente.nomeFantasia || i.pedido.cliente.razaoSocial}</Td>
                  <Td>
                    {i.produto.codigo} - {i.produto.descricao}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    {formatarQuantidade(i.pedidoItem.quantidade)} {i.pedidoItem.tipoEmbalagem}
                  </Td>
                  <Td className="whitespace-nowrap text-right">{formatarMoeda(i.valorBase)}</Td>
                  <Td className="text-right">{String(i.percentual).replace('.', ',')}%</Td>
                  <Td className="whitespace-nowrap text-right font-medium">
                    {formatarMoeda(i.valorComissao)}
                  </Td>
                  <Td>
                    <BadgeStatus status={i.pedido.status} />
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Tabela>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Itens de pedidos aprovados (ainda não faturados) aparecem em cinza e não entram no total a
        pagar.
      </p>
    </Dialog>
  );
}
