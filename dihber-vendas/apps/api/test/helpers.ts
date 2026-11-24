import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { criarApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

export { prisma };

export async function limparBanco() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "PedidoItem","Pedido","Dispositivo","Sessao","Usuario","Vendedor","Supervisor","Cliente","Produto" RESTART IDENTITY CASCADE',
  );
}

export interface Cenario {
  app: FastifyInstance;
  supA: { id: string };
  supB: { id: string };
  vend1: { id: string };
  vend2: { id: string };
  vendOutraEquipe: { id: string };
  cliente: { id: string };
  clienteInativo: { id: string };
  produto: { id: string };
  produto2: { id: string };
  tokens: { admin: string; supervisor: string; supervisorB: string; vendedor1: string; vendedor2: string; vendedorB: string };
}

export const dispositivo = { deviceId: 'device-teste-1', modelo: 'Samsung SM-A155M', sistema: 'Android 14', appVersao: '1.0.0' };

export async function montarCenario(): Promise<Cenario> {
  await limparBanco();
  const app = await criarApp();
  const senhaHash = await bcrypt.hash('senha123', 4);

  const supA = await prisma.supervisor.create({ data: { codigo: 'SA', nome: 'Supervisor A' } });
  const supB = await prisma.supervisor.create({ data: { codigo: 'SB', nome: 'Supervisor B' } });
  const vend1 = await prisma.vendedor.create({ data: { codigo: 'V1', nome: 'Vendedor 1', supervisorId: supA.id } });
  const vend2 = await prisma.vendedor.create({ data: { codigo: 'V2', nome: 'Vendedor 2', supervisorId: supA.id } });
  const vendOutraEquipe = await prisma.vendedor.create({ data: { codigo: 'V3', nome: 'Vendedor B', supervisorId: supB.id } });

  await prisma.usuario.createMany({
    data: [
      { nome: 'Admin', login: 'admin', perfil: 'ADMIN', senhaHash },
      { nome: 'Sup A', login: 'supa', perfil: 'SUPERVISOR', supervisorId: supA.id, senhaHash },
      { nome: 'Sup B', login: 'supb', perfil: 'SUPERVISOR', supervisorId: supB.id, senhaHash },
      { nome: 'V1', login: 'v1', perfil: 'VENDEDOR', vendedorId: vend1.id, senhaHash },
      { nome: 'V2', login: 'v2', perfil: 'VENDEDOR', vendedorId: vend2.id, senhaHash },
      { nome: 'V3', login: 'v3', perfil: 'VENDEDOR', vendedorId: vendOutraEquipe.id, senhaHash },
    ],
  });

  const cliente = await prisma.cliente.create({
    data: { codigo: 'C1', razaoSocial: 'Mercado X', cpfCnpj: '11222333000181' },
  });
  const clienteInativo = await prisma.cliente.create({
    data: { codigo: 'C2', razaoSocial: 'Cliente Inativo', cpfCnpj: '52998224725', ativo: false },
  });
  const produto = await prisma.produto.create({
    data: { codigo: 'P1', descricao: 'ARROZ 5KG', embalagem: 'CX C/ 6 UN', qtdPorCaixa: 6, precoUnitario: 10.5 },
  });
  const produto2 = await prisma.produto.create({
    data: { codigo: 'P2', descricao: 'FEIJÃO 1KG', embalagem: 'CX C/ 10 UN', qtdPorCaixa: 10, precoUnitario: 7.99 },
  });

  const login = async (l: string, origem: 'web' | 'app') => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { login: l, senha: 'senha123', origem, ...(origem === 'app' ? { dispositivo: { ...dispositivo, deviceId: `dev-${l}` } } : {}) },
    });
    if (r.statusCode !== 200) throw new Error(`login ${l}: ${r.body}`);
    return r.json().accessToken as string;
  };

  const tokens = {
    admin: await login('admin', 'web'),
    supervisor: await login('supa', 'web'),
    supervisorB: await login('supb', 'web'),
    vendedor1: await login('v1', 'app'),
    vendedor2: await login('v2', 'app'),
    vendedorB: await login('v3', 'app'),
  };

  return { app, supA, supB, vend1, vend2, vendOutraEquipe, cliente, clienteInativo, produto, produto2, tokens };
}

export const auth = (token: string) => ({ authorization: `Bearer ${token}` });

export function novoPedido(clienteId: string, itens: { produtoId: string; tipoEmbalagem: 'CX' | 'UN'; quantidade: number }[], extra: Record<string, unknown> = {}) {
  return { id: randomUUID(), clienteId, criadoNoAppEm: new Date().toISOString(), itens, ...extra };
}
