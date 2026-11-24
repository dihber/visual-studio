import type { FastifyInstance } from 'fastify';
import {
  clienteSchema,
  produtoSchema,
  somenteDigitos,
  supervisorSchema,
  vendedorSchema,
} from '@dihber/shared';
import { registrarCrud } from './crud';

export async function rotasCadastros(app: FastifyInstance) {
  registrarCrud(app, {
    rota: '/supervisores',
    modelo: 'supervisor',
    nomeExibicao: 'Supervisor',
    schema: supervisorSchema,
    camposBusca: ['codigo', 'nome', 'email'],
    ordenarPor: 'nome',
    include: { _count: { select: { vendedores: true } } },
    includeDetalhe: {
      vendedores: {
        select: { id: true, codigo: true, nome: true, ativo: true },
        orderBy: { nome: 'asc' },
      },
      usuario: { select: { id: true, login: true, nome: true } },
    },
    perfisLeitura: ['ADMIN', 'SUPERVISOR'],
    filtroLeitura: (req) =>
      req.usuario.perfil === 'SUPERVISOR' ? { id: req.usuario.supervisorId ?? '-' } : {},
  });

  registrarCrud(app, {
    rota: '/vendedores',
    modelo: 'vendedor',
    nomeExibicao: 'Vendedor',
    schema: vendedorSchema,
    camposBusca: ['codigo', 'nome', 'email'],
    ordenarPor: 'nome',
    include: {
      supervisor: { select: { id: true, codigo: true, nome: true } },
      usuario: { select: { id: true, login: true } },
    },
    perfisLeitura: ['ADMIN', 'SUPERVISOR'],
    // supervisor só enxerga os vendedores da própria equipe
    filtroLeitura: (req) =>
      req.usuario.perfil === 'SUPERVISOR' ? { supervisorId: req.usuario.supervisorId ?? '-' } : {},
    filtrosExtras: (q) =>
      typeof q.supervisorId === 'string' && q.supervisorId ? { supervisorId: q.supervisorId } : {},
  });

  registrarCrud(app, {
    rota: '/clientes',
    modelo: 'cliente',
    nomeExibicao: 'Cliente',
    schema: clienteSchema,
    camposBusca: ['codigo', 'razaoSocial', 'nomeFantasia', 'cidade'],
    ordenarPor: 'razaoSocial',
    perfisLeitura: ['ADMIN', 'SUPERVISOR'],
    montarBusca: (busca) => {
      const digitos = somenteDigitos(busca);
      return {
        OR: [
          ...['codigo', 'razaoSocial', 'nomeFantasia', 'cidade'].map((c) => ({
            [c]: { contains: busca, mode: 'insensitive' },
          })),
          ...(digitos.length >= 3 ? [{ cpfCnpj: { contains: digitos } }] : []),
        ],
      };
    },
  });

  registrarCrud(app, {
    rota: '/produtos',
    modelo: 'produto',
    nomeExibicao: 'Produto',
    schema: produtoSchema,
    camposBusca: ['codigo', 'descricao'],
    ordenarPor: 'descricao',
    perfisLeitura: ['ADMIN', 'SUPERVISOR'],
  });
}
