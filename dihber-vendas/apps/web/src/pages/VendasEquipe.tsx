import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatarMoeda } from '@dihber/shared';
import { http } from '@/api/cliente';
import type { VendaVendedor } from '@/api/tipos';
import { useAuth } from '@/hooks/useAuth';
import { useOpcoes } from '@/hooks/useOpcoes';
import { Card, CardTitulo } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { LinhaVazia, Tabela, Td, Th } from '@/components/ui/table';
import { FiltroPeriodo } from '@/components/FiltroPeriodo';
import { hojeISO, inicioDoMesISO } from '@/lib/utils';

const COR_BARRA = '#2563eb';
const compacto = (v: number) =>
  v.toLocaleString('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL' });

export function VendasEquipe() {
  const { ehAdmin, usuario } = useAuth();
  const supervisores = useOpcoes('/supervisores', ehAdmin);
  const [inicio, setInicio] = useState(inicioDoMesISO());
  const [fim, setFim] = useState(hojeISO());
  const [supervisorId, setSupervisorId] = useState('');

  const q = useQuery({
    queryKey: ['/pedidos/vendas-equipe', inicio, fim, supervisorId],
    queryFn: () =>
      http.get<VendaVendedor[]>('/pedidos/vendas-equipe', {
        dataInicio: inicio,
        dataFim: fim,
        supervisorId,
      }),
  });
  const dados = (q.data ?? []).map((d) => ({ nome: d.vendedor?.nome ?? '-', ...d }));
  const total = dados.reduce((s, d) => s + d.total, 0);
  const pedidos = dados.reduce((s, d) => s + d.pedidos, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Vendas da equipe</h1>
        <p className="text-sm text-slate-500">
          Total por vendedor no período (pedidos pendentes e aprovados)
          {usuario?.supervisor && ` · Equipe de ${usuario.supervisor.nome}`}
        </p>
      </div>

      <Card className="flex flex-wrap items-center gap-3 p-4">
        <FiltroPeriodo
          inicio={inicio}
          fim={fim}
          aoMudar={(i, f) => {
            setInicio(i);
            setFim(f);
          }}
        />
        {ehAdmin && (
          <Select
            className="w-56"
            value={supervisorId}
            onChange={(e) => setSupervisorId(e.target.value)}
            aria-label="Supervisor"
          >
            <option value="">Todas as equipes</option>
            {supervisores.todasOpcoes.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">Total vendido</p>
          <p className="text-2xl font-semibold">{formatarMoeda(total)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">Pedidos</p>
          <p className="text-2xl font-semibold">{pedidos.toLocaleString('pt-BR')}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitulo>Total vendido por vendedor</CardTitulo>
          <div className="p-4" style={{ height: Math.max(220, dados.length * 44 + 40) }}>
            {dados.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-500">
                {q.isLoading ? 'Carregando...' : 'Sem vendas no período'}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dados}
                  layout="vertical"
                  margin={{ left: 8, right: 24 }}
                  barCategoryGap={8}
                >
                  <CartesianGrid horizontal={false} stroke="#e2e8f0" />
                  <XAxis
                    type="number"
                    tickFormatter={compacto}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    width={130}
                    tick={{ fontSize: 12, fill: '#334155' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9' }}
                    formatter={(v: number) => [formatarMoeda(v), 'Total']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                  />
                  <Bar dataKey="total" fill={COR_BARRA} radius={[0, 4, 4, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitulo>Detalhamento</CardTitulo>
          <Tabela>
            <thead>
              <tr>
                <Th>Vendedor</Th>
                <Th className="text-right">Pedidos</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {dados.length === 0 ? (
                <LinhaVazia colunas={3} carregando={q.isLoading} mensagem="Sem vendas no período" />
              ) : (
                dados.map((d) => (
                  <tr key={d.vendedor?.id}>
                    <Td>
                      <Link
                        className="text-primary hover:underline"
                        to={`/pedidos?vendedorId=${d.vendedor?.id}&dataInicio=${inicio}&dataFim=${fim}`}
                      >
                        {d.nome}
                      </Link>
                    </Td>
                    <Td className="text-right">{d.pedidos}</Td>
                    <Td className="whitespace-nowrap text-right font-medium">
                      {formatarMoeda(d.total)}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Tabela>
        </Card>
      </div>
    </div>
  );
}
