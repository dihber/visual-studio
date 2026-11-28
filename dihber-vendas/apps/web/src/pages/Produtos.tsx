import { formatarMoeda, produtoSchema } from '@dihber/shared';
import { CelulaEstoque } from '@/components/EstoqueProduto';
import type { Produto } from '@/api/tipos';
import { PaginaCadastro } from '@/components/PaginaCadastro';
import { useAuth } from '@/hooks/useAuth';

const paraNumero = (v: unknown) => {
  if (v === '' || v === null || v === undefined) return v;
  const s = String(v).trim();
  // aceita "1.234,56" e "1234.56"
  return s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
};
const paraTexto = (n: number | null) =>
  n === null || n === undefined ? '' : String(n).replace('.', ',');

export function Produtos() {
  const { ehAdmin } = useAuth();
  return (
    <PaginaCadastro<Produto>
      titulo="Produtos"
      subtitulo={ehAdmin ? undefined : 'Consulta'}
      endpoint="/produtos"
      nomeItem="produto"
      placeholderBusca="Buscar por código ou descrição..."
      colunas={[
        { titulo: 'Código', render: (p) => <span className="font-mono">{p.codigo}</span> },
        { titulo: 'Descrição', render: (p) => <span className="font-medium">{p.descricao}</span> },
        { titulo: 'Embalagem', render: (p) => p.embalagem },
        { titulo: 'Qtd/CX', render: (p) => p.qtdPorCaixa, className: 'text-right' },
        {
          titulo: 'Preço UN',
          render: (p) => formatarMoeda(p.precoUnitario),
          className: 'text-right whitespace-nowrap',
        },
        {
          titulo: 'Comissão',
          render: (p) =>
            p.comissaoPercentual > 0 ? `${String(p.comissaoPercentual).replace('.', ',')}%` : '-',
          className: 'text-right',
        },
        {
          titulo: 'Disponível',
          render: (p) => <CelulaEstoque produto={p} />,
          className: 'text-right',
        },
      ]}
      campos={[
        { nome: 'codigo', label: 'Código', obrigatorio: true, largura: 'terco', maxLength: 30 },
        { nome: 'descricao', label: 'Descrição', obrigatorio: true, largura: 'inteira' },
        {
          nome: 'embalagem',
          label: 'Embalagem',
          obrigatorio: true,
          largura: 'metade',
          placeholder: 'CX C/ 12 UN',
        },
        {
          nome: 'qtdPorCaixa',
          label: 'Quantidade por caixa',
          tipo: 'numero',
          obrigatorio: true,
          largura: 'metade',
          ajuda: '1 CX = N unidades',
        },
        {
          nome: 'precoUnitario',
          label: 'Preço unitário (R$)',
          tipo: 'decimal',
          obrigatorio: true,
          largura: 'metade',
          placeholder: '0,00',
        },
        {
          nome: 'estoque',
          label: 'Estoque total em UN (opcional)',
          tipo: 'decimal',
          largura: 'metade',
          ajuda: 'Vazio = sem controle de estoque',
        },
        {
          nome: 'comissaoPercentual',
          label: 'Comissão do vendedor (%)',
          tipo: 'decimal',
          largura: 'metade',
          placeholder: '0',
          ajuda: 'Sobre o valor vendido. Ex.: 5% de R$ 100,00 = R$ 5,00',
        },
        { nome: 'ativo', label: 'Ativo', tipo: 'ativo' },
      ]}
      schemaCriar={produtoSchema}
      valoresIniciais={{ ativo: true, qtdPorCaixa: '1' }}
      paraFormulario={(p) => ({
        ...p,
        qtdPorCaixa: String(p.qtdPorCaixa),
        precoUnitario: paraTexto(p.precoUnitario),
        estoque: paraTexto(p.estoque),
        comissaoPercentual: p.comissaoPercentual ? paraTexto(p.comissaoPercentual) : '',
      })}
      paraEnvio={(v) => ({
        ...v,
        precoUnitario: paraNumero(v.precoUnitario),
        estoque: paraNumero(v.estoque),
        comissaoPercentual: paraNumero(v.comissaoPercentual),
      })}
    />
  );
}
