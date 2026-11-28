import { z } from 'zod';
import { STATUS_PEDIDO, TIPOS_EMBALAGEM } from '../enums';
import { dispositivoSchema } from './auth';

export const pedidoItemSyncSchema = z.object({
  produtoId: z.string().uuid(),
  tipoEmbalagem: z.enum(TIPOS_EMBALAGEM),
  quantidade: z.number().positive('Quantidade deve ser maior que zero').max(1_000_000),
});
export type PedidoItemSync = z.infer<typeof pedidoItemSyncSchema>;

export const pedidoSyncSchema = z.object({
  id: z.string().uuid(),
  clienteId: z.string().uuid(),
  observacao: z.string().max(1000).optional().nullable(),
  criadoNoAppEm: z.string().datetime({ offset: true }),
  itens: z.array(pedidoItemSyncSchema).min(1, 'Pedido sem itens'),
  /** Valor calculado no app — apenas informativo, o servidor recalcula. */
  valorTotal: z.number().optional(),
});
export type PedidoSync = z.infer<typeof pedidoSyncSchema>;

export const syncPedidosSchema = z.object({
  dispositivo: dispositivoSchema,
  pedidos: z.array(z.unknown()).max(500),
});

export interface SyncPedidosResposta {
  aceitos: { id: string; numero: number }[];
  rejeitados: { id: string | null; erro: string }[];
}

export const syncDadosQuerySchema = z.object({
  desde: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().datetime({ offset: true }).optional(),
  ),
  deviceId: z.string().optional(),
});

export interface SyncDadosResposta {
  servidorAgora: string;
  clientes: ClienteSync[];
  produtos: ProdutoSync[];
  statusPedidos: {
    id: string;
    numero: number;
    status: (typeof STATUS_PEDIDO)[number];
    motivoReprovacao: string | null;
    motivoCancelamento: string | null;
  }[];
}

export interface ClienteSync {
  id: string;
  codigo: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cpfCnpj: string;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  ativo: boolean;
  updatedAt: string;
}

export interface ProdutoSync {
  id: string;
  codigo: string;
  descricao: string;
  embalagem: string;
  qtdPorCaixa: number;
  precoUnitario: number;
  estoque: number | null;
  ativo: boolean;
  updatedAt: string;
}

export const pedidosQuerySchema = z.object({
  status: z.enum(STATUS_PEDIDO).optional(),
  vendedorId: z.string().uuid().optional(),
  supervisorId: z.string().uuid().optional(),
  clienteId: z.string().uuid().optional(),
  dispositivoId: z.string().uuid().optional(),
  dataInicio: z.string().date().optional(),
  dataFim: z.string().date().optional(),
  busca: z.string().trim().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(500).default(20),
});
export type PedidosQuery = z.infer<typeof pedidosQuerySchema>;

export const reprovarSchema = z.object({
  motivo: z.string().trim().min(3, 'Informe o motivo da reprovação').max(500),
});

export const cancelarSchema = z.object({
  motivo: z.string().trim().min(3, 'Informe o motivo do cancelamento').max(500),
});
