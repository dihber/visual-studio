export const PERFIS = ['ADMIN', 'SUPERVISOR', 'VENDEDOR'] as const;
export type Perfil = (typeof PERFIS)[number];

export const STATUS_PEDIDO = ['PENDENTE', 'APROVADO', 'REPROVADO', 'CANCELADO'] as const;
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
};
