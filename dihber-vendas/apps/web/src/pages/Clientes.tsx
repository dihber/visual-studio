import { clienteSchema, formatarCpfCnpj } from '@dihber/shared';
import type { Cliente } from '@/api/tipos';
import { PaginaCadastro } from '@/components/PaginaCadastro';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useOpcoes } from '@/hooks/useOpcoes';

const UFS =
  'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

export function Clientes() {
  const { ehAdmin } = useAuth();
  const vendedores = useOpcoes('/vendedores', ehAdmin);
  const tabelas = useOpcoes('/tabelas-preco', ehAdmin);
  const prazos = useOpcoes('/prazos', ehAdmin);

  return (
    <PaginaCadastro<Cliente>
      titulo="Clientes"
      subtitulo={ehAdmin ? undefined : 'Consulta'}
      endpoint="/clientes"
      nomeItem="cliente"
      placeholderBusca="Buscar por código, nome, CPF/CNPJ ou cidade..."
      colunas={[
        { titulo: 'Código', render: (c) => <span className="font-mono">{c.codigo}</span> },
        {
          titulo: 'Cliente',
          render: (c) => (
            <div>
              <div className="font-medium">{c.razaoSocial}</div>
              {c.nomeFantasia && <div className="text-xs text-slate-500">{c.nomeFantasia}</div>}
            </div>
          ),
        },
        {
          titulo: 'CPF/CNPJ',
          render: (c) => <span className="whitespace-nowrap">{formatarCpfCnpj(c.cpfCnpj)}</span>,
        },
        { titulo: 'Cidade/UF', render: (c) => [c.cidade, c.uf].filter(Boolean).join(' / ') || '-' },
        {
          titulo: 'Vendedores',
          render: (c) =>
            c.vendedores.length === 0 ? (
              <Badge cor="amarelo">Sem vendedor</Badge>
            ) : (
              <span title={c.vendedores.map((v) => v.vendedor.nome).join(', ')}>
                {c.vendedores.length === 1
                  ? c.vendedores[0].vendedor.nome
                  : `${c.vendedores.length} vendedores`}
              </span>
            ),
        },
        {
          titulo: 'Tabela / Pagamento',
          render: (c) => (
            <div className="text-xs">
              <div>
                {c.tabelaPreco ? (
                  c.tabelaPreco.nome
                ) : (
                  <span className="text-slate-400">Preço base</span>
                )}
              </div>
              <div className="text-slate-500">
                PIX
                {c.prazos
                  .filter((p) => p.prazo.ativo)
                  .map((p) => ` · Boleto ${p.prazo.descricao}`)
                  .join('')}
              </div>
            </div>
          ),
        },
      ]}
      campos={[
        { nome: 'codigo', label: 'Código', obrigatorio: true, largura: 'terco', maxLength: 30 },
        { nome: 'cpfCnpj', label: 'CPF/CNPJ', obrigatorio: true, largura: 'terco', maxLength: 18 },
        { nome: 'telefone', label: 'Telefone', largura: 'terco' },
        { nome: 'razaoSocial', label: 'Razão social', obrigatorio: true, largura: 'inteira' },
        { nome: 'nomeFantasia', label: 'Nome fantasia', largura: 'metade' },
        { nome: 'email', label: 'E-mail', tipo: 'email', largura: 'metade' },
        { nome: 'endereco', label: 'Endereço', largura: 'inteira' },
        { nome: 'cidade', label: 'Cidade', largura: 'metade' },
        {
          nome: 'uf',
          label: 'UF',
          tipo: 'select',
          largura: 'metade',
          opcoes: UFS.map((u) => ({ valor: u, label: u })),
        },
        {
          nome: 'vendedorIds',
          label: 'Vendedores (carteira)',
          tipo: 'multi',
          largura: 'inteira',
          opcoes: vendedores.todasOpcoes,
          vazio: 'Nenhum vendedor cadastrado',
          ajuda:
            'Só os vendedores marcados veem este cliente no app. Sem nenhum, ele não aparece para ninguém.',
        },
        {
          nome: 'tabelaPrecoId',
          label: 'Tabela de preço',
          tipo: 'select',
          largura: 'metade',
          opcoes: tabelas.todasOpcoes,
          vazio: 'Nenhuma (preço base do produto)',
        },
        {
          nome: 'prazoIds',
          label: 'Prazos de boleto permitidos',
          tipo: 'multi',
          largura: 'metade',
          opcoes: prazos.todasOpcoes,
          vazio: 'Nenhum prazo cadastrado (menu Prazos)',
          ajuda: 'PIX é sempre permitido. Sem prazo marcado, o cliente não pode pagar em boleto.',
        },
        { nome: 'ativo', label: 'Ativo', tipo: 'ativo' },
      ]}
      schemaCriar={clienteSchema}
      valoresIniciais={{ ativo: true, vendedorIds: [], prazoIds: [], tabelaPrecoId: '' }}
      paraFormulario={(c) => ({
        ...c,
        cpfCnpj: formatarCpfCnpj(c.cpfCnpj),
        tabelaPrecoId: c.tabelaPrecoId ?? '',
        vendedorIds: c.vendedores.map((v) => v.vendedor.id),
        prazoIds: c.prazos.map((p) => p.prazo.id),
      })}
    />
  );
}
