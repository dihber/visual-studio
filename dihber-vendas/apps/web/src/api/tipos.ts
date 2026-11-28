import type { Paginado, Perfil, StatusPedido, TipoEmbalagem } from '@dihber/shared';

export type { Paginado };

export interface Supervisor {
  id: string;
  codigo: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  _count?: { vendedores: number };
  vendedores?: { id: string; codigo: string; nome: string; ativo: boolean }[];
  usuario?: { id: string; login: string; nome: string } | null;
}

export interface Vendedor {
  id: string;
  codigo: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  supervisorId: string | null;
  supervisor: { id: string; codigo: string; nome: string } | null;
  usuario: { id: string; login: string } | null;
}

export interface Cliente {
  id: string;
  codigo: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cpfCnpj: string;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  ativo: boolean;
  tabelaPrecoId: string | null;
  tabelaPreco: { id: string; codigo: string; nome: string } | null;
  vendedores: { vendedor: { id: string; codigo: string; nome: string } }[];
  prazos: { prazo: { id: string; codigo: string; descricao: string; ativo: boolean } }[];
}

export interface TabelaPreco {
  id: string;
  codigo: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  ativo: boolean;
  _count?: { itens: number; clientes: number };
}

export interface ItemTabelaPreco {
  produtoId: string;
  codigo: string;
  descricao: string;
  embalagem: string;
  precoBase: number;
  preco: number | null;
}

export interface PrazoPagamento {
  id: string;
  codigo: string;
  descricao: string;
  ativo: boolean;
  _count?: { clientes: number };
}

export interface Produto {
  id: string;
  codigo: string;
  descricao: string;
  embalagem: string;
  qtdPorCaixa: number;
  precoUnitario: number;
  estoque: number | null;
  comissaoPercentual: number;
  /** pedidos pendentes e aprovados */
  estoqueReservado: number;
  /** null = produto sem controle de estoque */
  estoqueDisponivel: number | null;
  ativo: boolean;
}

export interface ReservasProduto {
  produto: { id: string; codigo: string; descricao: string };
  estoque: number | null;
  reservado: number;
  disponivel: number | null;
  pedidos: {
    tipoEmbalagem: TipoEmbalagem;
    quantidade: number;
    qtdUnidades: number;
    pedido: {
      id: string;
      numero: number;
      status: StatusPedido;
      criadoNoAppEm: string;
      cliente: { codigo: string; razaoSocial: string; nomeFantasia: string | null };
      vendedor: { nome: string };
    };
  }[];
}

export interface ResumoComissao {
  pedidos: number;
  faturamento: number;
  comissao: number;
}

export interface RelatorioComissoes {
  competencia: string;
  vendedores: {
    vendedor: { id: string; codigo: string; nome: string };
    faturado: ResumoComissao;
    previsao: ResumoComissao;
  }[];
  total: { faturado: ResumoComissao; previsao: ResumoComissao };
}

export interface ItemComissao {
  valorBase: number;
  percentual: number;
  valorComissao: number;
  statusTexto: string;
  produto: { codigo: string; descricao: string };
  pedidoItem: { tipoEmbalagem: TipoEmbalagem; quantidade: number };
  pedido: {
    id: string;
    numero: number;
    status: StatusPedido;
    criadoNoAppEm: string;
    cliente: { razaoSocial: string; nomeFantasia: string | null };
  };
}

export interface Dispositivo {
  id: string;
  deviceId: string;
  modelo: string | null;
  sistema: string | null;
  appVersao: string | null;
  ultimoSync: string | null;
  createdAt: string;
}

export interface Usuario {
  id: string;
  nome: string;
  login: string;
  perfil: Perfil;
  ativo: boolean;
  vendedorId: string | null;
  supervisorId: string | null;
  vendedor: { id: string; codigo: string; nome: string } | null;
  supervisor: { id: string; codigo: string; nome: string } | null;
  dispositivos?: Dispositivo[];
}

export interface PedidoLista {
  id: string;
  numero: number;
  status: StatusPedido;
  valorTotal: number;
  criadoNoAppEm: string;
  recebidoEm: string;
  cliente: { id: string; codigo: string; razaoSocial: string; nomeFantasia: string | null };
  vendedor: {
    id: string;
    codigo: string;
    nome: string;
    supervisor: { id: string; nome: string } | null;
  };
  dispositivo: { id: string; modelo: string | null; sistema: string | null };
  _count: { itens: number };
}

export interface PedidoDetalhe extends Omit<PedidoLista, '_count' | 'cliente' | 'dispositivo'> {
  observacao: string | null;
  formaPagamento: 'PIX' | 'BOLETO' | null;
  prazoDescricao: string | null;
  motivoReprovacao: string | null;
  avaliadoEm: string | null;
  avaliadoPor: { id: string; nome: string } | null;
  motivoCancelamento: string | null;
  canceladoEm: string | null;
  canceladoPor: { id: string; nome: string } | null;
  cliente: Cliente;
  dispositivo: Dispositivo;
  itens: {
    id: string;
    tipoEmbalagem: TipoEmbalagem;
    quantidade: number;
    qtdUnidades: number;
    precoUnitario: number;
    valorTotal: number;
    comissao: { percentual: number; valorComissao: number } | null;
    produto: {
      id: string;
      codigo: string;
      descricao: string;
      embalagem: string;
      qtdPorCaixa: number;
    };
  }[];
}

export interface ResumoPedidos {
  pendentesHoje: number;
  pendentes: number;
  aprovados: number;
  reprovados: number;
  totalVendido: number;
}

export interface VendaVendedor {
  vendedor: { id: string; codigo: string; nome: string };
  pedidos: number;
  total: number;
}

export type StatusBuildApp = 'NA_FILA' | 'GERANDO' | 'CONCLUIDO' | 'FALHOU';

export interface AppBuild {
  id: string;
  status: StatusBuildApp;
  solicitadoEm: string;
  concluidoEm: string | null;
  versao: string | null;
  urlDownload: string | null;
  githubRunUrl: string | null;
  erro: string | null;
  solicitadoPor: { id: string; nome: string };
}

export interface ProgressoBuild {
  percentual: number;
  etapa: string;
  decorridoSeg: number;
  restanteSeg: number | null;
}
