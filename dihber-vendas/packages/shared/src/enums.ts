export const PERFIS = ['ADMIN', 'SUPERVISOR', 'VENDEDOR'] as const;
export type Perfil = (typeof PERFIS)[number];

export const STATUS_PEDIDO = [
  'PENDENTE',
  'APROVADO',
  'REPROVADO',
  'CANCELADO',
  'FATURADO',
] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];

export const TIPOS_EMBALAGEM = ['CX', 'UN'] as const;
export type TipoEmbalagem = (typeof TIPOS_EMBALAGEM)[number];

export const PERFIL_LABEL: Record<Perfil, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  VENDEDOR: 'Vendedor',
};

export const STATUS_PEDIDO_LABEL: Record<StatusPedido, string> = {
  PENDENTE: 'Pendente',
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
  CANCELADO: 'Cancelado',
  FATURADO: 'Faturado',
};

export const FORMAS_PAGAMENTO = ['PIX', 'BOLETO'] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

/** Texto da forma de pagamento do pedido (ex.: "PIX", "Boleto 30/60 dias"). */
export function textoPagamento(
  forma: FormaPagamento | null | undefined,
  prazoDescricao?: string | null,
): string {
  if (forma === 'PIX') return 'PIX';
  if (forma === 'BOLETO') return prazoDescricao ? `Boleto ${prazoDescricao}` : 'Boleto';
  return 'Não informado';
}
