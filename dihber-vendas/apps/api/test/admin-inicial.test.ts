import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { criarAdminInicial } from '../src/lib/admin-inicial';
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
