import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { criarAdminInicial, redefinirSenhaAdmin } from '../src/lib/admin-inicial';
import { limparBanco } from './helpers';

const log = { info: () => undefined };

beforeAll(limparBanco);

afterEach(() => {
  delete process.env.ADMIN_SENHA_INICIAL;
});

describe('administrador inicial', () => {
  it('sem a variável não cria nada', async () => {
    await criarAdminInicial(log);
    expect(await prisma.usuario.count({ where: { perfil: 'ADMIN' } })).toBe(0);
  });
  it('rejeita senha curta', async () => {
    process.env.ADMIN_SENHA_INICIAL = '123';
    await expect(criarAdminInicial(log)).rejects.toThrow(/8 caracteres/);
  });
  it('cria o admin uma única vez e não altera senha existente', async () => {
    process.env.ADMIN_SENHA_INICIAL = 'senha-forte-1';
    await criarAdminInicial(log);
    process.env.ADMIN_SENHA_INICIAL = 'outra-senha-2';
    await criarAdminInicial(log);
    const admins = await prisma.usuario.findMany({ where: { perfil: 'ADMIN' } });
    expect(admins).toHaveLength(1);
    expect(admins[0].login).toBe('admin');
    expect(await bcrypt.compare('senha-forte-1', admins[0].senhaHash)).toBe(true);
  });
});

describe('redefinir senha do admin (ADMIN_REDEFINIR_SENHA)', () => {
  const logR = { info: () => undefined, warn: () => undefined };
  afterEach(() => {
    delete process.env.ADMIN_REDEFINIR_SENHA;
  });

  it('sem a variável não altera nada', async () => {
    const antes = await prisma.usuario.findFirst({ where: { login: 'admin' } });
    await redefinirSenhaAdmin(logR);
    const depois = await prisma.usuario.findFirst({ where: { login: 'admin' } });
    expect(depois?.senhaHash).toBe(antes?.senhaHash);
  });

  it('ignora senha curta sem derrubar a API', async () => {
    const antes = await prisma.usuario.findFirst({ where: { login: 'admin' } });
    process.env.ADMIN_REDEFINIR_SENHA = '123';
    await expect(redefinirSenhaAdmin(logR)).resolves.toBeUndefined();
    const depois = await prisma.usuario.findFirst({ where: { login: 'admin' } });
    expect(depois?.senhaHash).toBe(antes?.senhaHash);
  });

  it('troca a senha, reativa o admin e encerra as sessões', async () => {
    const admin = await prisma.usuario.findFirstOrThrow({ where: { login: 'admin' } });
    await prisma.usuario.update({ where: { id: admin.id }, data: { ativo: false } });
    await prisma.sessao.create({
      data: { usuarioId: admin.id, tokenHash: 'h-teste', expiraEm: new Date(Date.now() + 1e7) },
    });
    process.env.ADMIN_REDEFINIR_SENHA = 'nova-senha-forte';
    await redefinirSenhaAdmin(logR);
    const depois = await prisma.usuario.findUniqueOrThrow({ where: { id: admin.id } });
    expect(depois.ativo).toBe(true);
    expect(await bcrypt.compare('nova-senha-forte', depois.senhaHash)).toBe(true);
    expect(await prisma.sessao.count({ where: { usuarioId: admin.id, revogadaEm: null } })).toBe(0);
  });

  it('cria o admin se ele não existir', async () => {
    await prisma.sessao.deleteMany({});
    await prisma.usuario.deleteMany({ where: { login: 'admin' } });
    process.env.ADMIN_REDEFINIR_SENHA = 'outra-senha-forte';
    await redefinirSenhaAdmin(logR);
    const novo = await prisma.usuario.findFirstOrThrow({ where: { login: 'admin' } });
    expect(novo.perfil).toBe('ADMIN');
    expect(await bcrypt.compare('outra-senha-forte', novo.senhaHash)).toBe(true);
  });
});
