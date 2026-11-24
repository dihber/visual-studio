import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, X } from 'lucide-react';
import {
  formatarCpfCnpj,
  formatarDataHora,
  formatarMoeda,
  formatarQuantidade,
  reprovarSchema,
} from '@dihber/shared';
import { http } from '@/api/cliente';
import type { PedidoDetalhe as Pedido } from '@/api/tipos';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardTitulo } from '@/components/ui/card';
import { BadgeStatus } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Campo, Textarea } from '@/components/ui/input';
import { Alerta } from '@/components/ui/alerta';
import { Tabela, Td, Th } from '@/components/ui/table';

export function PedidoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const [reprovando, setReprovando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');

  const q = useQuery({
    queryKey: ['/pedidos', id],
    queryFn: () => http.get<Pedido>(`/pedidos/${id}`),
  });

  const avaliar = useMutation({
    mutationFn: (acao: 'aprovar' | 'reprovar') =>
      http.post(`/pedidos/${id}/${acao}`, acao === 'reprovar' ? { motivo } : undefined),
    onSuccess: () => {
      setReprovando(false);
      qc.invalidateQueries({ queryKey: ['/pedidos'] });
      qc.invalidateQueries({ queryKey: ['/pedidos/resumo'] });
    },
    onError: (e) => setErro(e.message),
  });

  if (q.isLoading) return <p className="text-slate-500">Carregando...</p>;
  if (q.error || !q.data) return <Alerta>{q.error?.message ?? 'Pedido não encontrado'}</Alerta>;
  const p = q.data;
  const podeAvaliar =
    p.status === 'PENDENTE' && (usuario?.perfil === 'ADMIN' || usuario?.perfil === 'SUPERVISOR');

  return (
    <div className="space-y-4">
      <Link
        to="/pedidos"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para pedidos
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Pedido nº {p.numero}</h1>
          <BadgeStatus status={p.status} />
        </div>
        {podeAvaliar && (
          <div className="flex gap-2">
            <Button
              variante="perigo"
              onClick={() => {
                setErro('');
                setMotivo('');
                setReprovando(true);
              }}
            >
              <X className="h-4 w-4" /> Reprovar
            </Button>
            <Button
              variante="sucesso"
              carregando={avaliar.isPending && !reprovando}
              onClick={() => {
                if (confirm(`Aprovar o pedido nº ${p.numero}?`)) {
                  setErro('');
                  avaliar.mutate('aprovar');
                }
              }}
            >
              <Check className="h-4 w-4" /> Aprovar
            </Button>
          </div>
        )}
      </div>
      {!reprovando && <Alerta>{erro}</Alerta>}

      {p.status === 'REPROVADO' && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Motivo da reprovação:</strong> {p.motivoReprovacao}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitulo>Cliente</CardTitulo>
          <dl className="space-y-1 px-5 py-4 text-sm">
            <Info rotulo="Razão social" valor={`${p.cliente.codigo} - ${p.cliente.razaoSocial}`} />
            {p.cliente.nomeFantasia && <Info rotulo="Fantasia" valor={p.cliente.nomeFantasia} />}
            <Info rotulo="CPF/CNPJ" valor={formatarCpfCnpj(p.cliente.cpfCnpj)} />
            <Info
              rotulo="Cidade"
              valor={[p.cliente.cidade, p.cliente.uf].filter(Boolean).join(' / ') || '-'}
            />
            <Info rotulo="Telefone" valor={p.cliente.telefone ?? '-'} />
          </dl>
        </Card>
        <Card>
          <CardTitulo>Venda</CardTitulo>
          <dl className="space-y-1 px-5 py-4 text-sm">
            <Info rotulo="Vendedor" valor={`${p.vendedor.codigo} - ${p.vendedor.nome}`} />
            <Info rotulo="Supervisor" valor={p.vendedor.supervisor?.nome ?? '-'} />
            <Info
              rotulo="Celular"
              valor={
                [p.dispositivo.modelo, p.dispositivo.sistema].filter(Boolean).join(' · ') || '-'
              }
            />
            <Info rotulo="Versão do app" valor={p.dispositivo.appVersao ?? '-'} />
          </dl>
        </Card>
        <Card>
          <CardTitulo>Datas</CardTitulo>
          <dl className="space-y-1 px-5 py-4 text-sm">
            <Info rotulo="Feito no app" valor={formatarDataHora(p.criadoNoAppEm)} />
            <Info rotulo="Recebido" valor={formatarDataHora(p.recebidoEm)} />
            {p.avaliadoEm && (
              <Info
                rotulo={p.status === 'APROVADO' ? 'Aprovado' : 'Avaliado'}
                valor={`${formatarDataHora(p.avaliadoEm)} por ${p.avaliadoPor?.nome ?? '-'}`}
              />
            )}
          </dl>
        </Card>
      </div>

      <Card>
        <CardTitulo
          acoes={<span className="text-lg font-semibold">{formatarMoeda(p.valorTotal)}</span>}
        >
          Itens ({p.itens.length})
        </CardTitulo>
        <Tabela>
          <thead>
            <tr>
              <Th>Código</Th>
              <Th>Descrição</Th>
              <Th>Embalagem</Th>
              <Th>Tipo</Th>
              <Th className="text-right">Qtd</Th>
              <Th className="text-right">Qtd em UN</Th>
              <Th className="text-right">Preço UN</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {p.itens.map((i) => (
              <tr key={i.id}>
                <Td className="font-mono">{i.produto.codigo}</Td>
                <Td className="font-medium">{i.produto.descricao}</Td>
                <Td className="text-slate-600">{i.produto.embalagem}</Td>
                <Td>{i.tipoEmbalagem}</Td>
                <Td className="text-right">{formatarQuantidade(i.quantidade)}</Td>
                <Td className="text-right">{formatarQuantidade(i.qtdUnidades)}</Td>
                <Td className="whitespace-nowrap text-right">{formatarMoeda(i.precoUnitario)}</Td>
                <Td className="whitespace-nowrap text-right font-medium">
                  {formatarMoeda(i.valorTotal)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabela>
        {p.observacao && (
          <div className="border-t border-slate-100 px-5 py-3 text-sm">
            <span className="font-medium text-slate-700">Observação:</span> {p.observacao}
          </div>
        )}
      </Card>

      <Dialog
        aberto={reprovando}
        aoFechar={() => setReprovando(false)}
        titulo={`Reprovar pedido nº ${p.numero}`}
        rodape={
          <>
            <Button variante="secundario" onClick={() => setReprovando(false)}>
              Cancelar
            </Button>
            <Button
              variante="perigo"
              carregando={avaliar.isPending}
              onClick={() => {
                const r = reprovarSchema.safeParse({ motivo });
                if (!r.success) return setErro(r.error.issues[0].message);
                setErro('');
                avaliar.mutate('reprovar');
              }}
            >
              Reprovar
            </Button>
          </>
        }
      >
        <Campo label="Motivo da reprovação" obrigatorio>
          <Textarea
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={500}
            placeholder="Ex.: cliente com pendência financeira"
          />
        </Campo>
        <p className="mt-1 text-xs text-slate-500">
          O vendedor verá este motivo no app após sincronizar.
        </p>
        <div className="mt-3">
          <Alerta>{erro}</Alerta>
        </div>
      </Dialog>
    </div>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-slate-500">{rotulo}</dt>
      <dd className="min-w-0 font-medium text-slate-800">{valor}</dd>
    </div>
  );
}
