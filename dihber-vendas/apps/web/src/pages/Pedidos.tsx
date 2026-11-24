import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, Download, Search, Wallet, XCircle } from 'lucide-react';
import { STATUS_PEDIDO, STATUS_PEDIDO_LABEL, formatarDataHora, formatarMoeda } from '@dihber/shared';
import { baixarArquivo, http } from '@/api/cliente';
import type { Paginado, PedidoLista, ResumoPedidos } from '@/api/tipos';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { useOpcoes } from '@/hooks/useOpcoes';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { BadgeStatus } from '@/components/ui/badge';
import { LinhaVazia, Paginacao, Tabela, Td, Th } from '@/components/ui/table';
import { Alerta } from '@/components/ui/alerta';
import { FiltroPeriodo } from '@/components/FiltroPeriodo';
import { hojeISO } from '@/lib/utils';

export function Pedidos() {
  const { usuario, ehAdmin } = useAuth();
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const [busca, setBusca] = useState(params.get('busca') ?? '');
  const buscaDeb = useDebounce(busca);
  const vendedores = useOpcoes('/vendedores');
  const supervisores = useOpcoes('/supervisores', ehAdmin);
  const [exportando, setExportando] = useState(false);

  const filtros = {
    status: params.get('status') ?? '',
    vendedorId: params.get('vendedorId') ?? '',
    supervisorId: params.get('supervisorId') ?? '',
    dataInicio: params.get('dataInicio') ?? '',
    dataFim: params.get('dataFim') ?? '',
    busca: buscaDeb,
  };
  const pagina = Number(params.get('pagina') ?? 1);

  const definir = (novos: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(novos)) v ? p.set(k, v) : p.delete(k);
    if (!('pagina' in novos)) p.delete('pagina');
    setParams(p, { replace: true });
  };

  const lista = useQuery({
    queryKey: ['/pedidos', filtros, pagina],
    queryFn: () => http.get<Paginado<PedidoLista>>('/pedidos', { ...filtros, pagina, porPagina: 25 }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const resumo = useQuery({
    queryKey: ['/pedidos/resumo', filtros],
    queryFn: () => http.get<ResumoPedidos>('/pedidos/resumo', { ...filtros, status: undefined }),
    refetchInterval: 60_000,
  });

  const exportar = async () => {
    setExportando(true);
    try {
      await baixarArquivo('/pedidos/exportar', filtros, `pedidos-${hojeISO()}.csv`);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setExportando(false);
    }
  };

  const r = resumo.data;
  const dados = lista.data?.dados ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pedidos</h1>
          {usuario?.perfil === 'SUPERVISOR' && <p className="text-sm text-slate-500">Pedidos da sua equipe</p>}
        </div>
        <Button variante="secundario" onClick={exportar} carregando={exportando}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Contador icone={Clock} cor="text-amber-600 bg-amber-50" titulo="Pendentes hoje" valor={r?.pendentesHoje} detalhe={r ? `${r.pendentes} pendentes no total` : undefined} />
        <Contador icone={CheckCircle2} cor="text-emerald-600 bg-emerald-50" titulo="Aprovados" valor={r?.aprovados} />
        <Contador icone={XCircle} cor="text-red-600 bg-red-50" titulo="Reprovados" valor={r?.reprovados} />
        <Contador icone={Wallet} cor="text-blue-600 bg-blue-50" titulo="Total vendido no período" valor={r ? formatarMoeda(r.totalVendido) : undefined} detalhe="Pendentes + aprovados" />
      </div>

      <Card>
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="flex flex-wrap gap-3">
            <Select className="w-44" value={filtros.status} onChange={(e) => definir({ status: e.target.value })} aria-label="Status">
              <option value="">Todos os status</option>
              {STATUS_PEDIDO.map((s) => (
                <option key={s} value={s}>{STATUS_PEDIDO_LABEL[s]}</option>
              ))}
            </Select>
            <Select className="w-56" value={filtros.vendedorId} onChange={(e) => definir({ vendedorId: e.target.value })} aria-label="Vendedor">
              <option value="">Todos os vendedores</option>
              {vendedores.todasOpcoes.map((o) => (
                <option key={o.valor} value={o.valor}>{o.label}</option>
              ))}
            </Select>
            {ehAdmin && (
              <Select className="w-56" value={filtros.supervisorId} onChange={(e) => definir({ supervisorId: e.target.value })} aria-label="Supervisor">
                <option value="">Todos os supervisores</option>
                {supervisores.todasOpcoes.map((o) => (
                  <option key={o.valor} value={o.valor}>{o.label}</option>
                ))}
              </Select>
            )}
            <div className="relative min-w-60 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" placeholder="Nº do pedido, cliente ou vendedor..." value={busca} onChange={(e) => { setBusca(e.target.value); definir({}); }} />
            </div>
          </div>
          <FiltroPeriodo inicio={filtros.dataInicio} fim={filtros.dataFim} aoMudar={(i, f) => definir({ dataInicio: i, dataFim: f })} />
        </div>

        <Tabela>
          <thead>
            <tr>
              <Th>Nº</Th>
              <Th>Data</Th>
              <Th>Cliente</Th>
              <Th>Vendedor</Th>
              <Th>Supervisor</Th>
              <Th>Celular</Th>
              <Th className="text-right">Itens</Th>
              <Th className="text-right">Total</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {dados.length === 0 ? (
              <LinhaVazia colunas={9} carregando={lista.isLoading} mensagem="Nenhum pedido encontrado" />
            ) : (
              dados.map((p) => (
                <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navegar(`/pedidos/${p.id}`)}>
                  <Td>
                    <Link to={`/pedidos/${p.id}`} className="font-mono font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                      {p.numero}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap">{formatarDataHora(p.criadoNoAppEm)}</Td>
                  <Td>
                    <div className="font-medium">{p.cliente.nomeFantasia || p.cliente.razaoSocial}</div>
                    <div className="text-xs text-slate-500">{p.cliente.codigo}</div>
                  </Td>
                  <Td>{p.vendedor.nome}</Td>
                  <Td>{p.vendedor.supervisor?.nome ?? '-'}</Td>
                  <Td className="text-slate-600">{p.dispositivo.modelo ?? '-'}</Td>
                  <Td className="text-right">{p._count.itens}</Td>
                  <Td className="whitespace-nowrap text-right font-medium">{formatarMoeda(p.valorTotal)}</Td>
                  <Td><BadgeStatus status={p.status} /></Td>
                </tr>
              ))
            )}
          </tbody>
        </Tabela>
        {lista.data && (
          <Paginacao pagina={pagina} porPagina={lista.data.porPagina} total={lista.data.total} aoMudar={(n) => definir({ pagina: String(n) })} />
        )}
        {lista.error && <div className="p-4"><Alerta>{lista.error.message}</Alerta></div>}
      </Card>
    </div>
  );
}

function Contador({
  icone: Icone,
  cor,
  titulo,
  valor,
  detalhe,
}: {
  icone: React.ComponentType<{ className?: string }>;
  cor: string;
  titulo: string;
  valor?: number | string;
  detalhe?: string;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className={`rounded-lg p-2.5 ${cor}`}>
        <Icone className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{titulo}</p>
        <p className="truncate text-xl font-semibold">{valor ?? '—'}</p>
        {detalhe && <p className="text-xs text-slate-400">{detalhe}</p>}
      </div>
    </Card>
  );
}
