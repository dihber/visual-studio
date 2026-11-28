import { prazoPagamentoSchema } from '@dihber/shared';
import type { PrazoPagamento } from '@/api/tipos';
import { PaginaCadastro } from '@/components/PaginaCadastro';

export function Prazos() {
  return (
    <PaginaCadastro<PrazoPagamento>
      titulo="Prazos de pagamento"
      subtitulo="Prazos de boleto. Vincule a cada cliente no cadastro de clientes. PIX é sempre permitido."
      endpoint="/prazos"
      nomeItem="prazo"
      placeholderBusca="Buscar por código ou descrição..."
      colunas={[
        { titulo: 'Código', render: (p) => <span className="font-mono">{p.codigo}</span> },
        { titulo: 'Descrição', render: (p) => <span className="font-medium">{p.descricao}</span> },
        { titulo: 'Clientes', render: (p) => p._count?.clientes ?? 0, className: 'text-right' },
      ]}
      campos={[
        { nome: 'codigo', label: 'Código', obrigatorio: true, largura: 'terco', maxLength: 30 },
        {
          nome: 'descricao',
          label: 'Descrição',
          obrigatorio: true,
          largura: 'inteira',
          placeholder: 'Ex.: 30 dias, 60 dias, 30/60 dias',
          ajuda: 'Aparece no app como "Boleto <descrição>".',
        },
        { nome: 'ativo', label: 'Ativo', tipo: 'ativo' },
      ]}
      schemaCriar={prazoPagamentoSchema}
      valoresIniciais={{ ativo: true }}
      paraFormulario={(p) => ({ ...p })}
    />
  );
}
