import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auth, montarCenario, type Cenario } from './helpers';

let c: Cenario;
beforeAll(async () => {
  c = await montarCenario();
});
afterAll(async () => {
  await c.app.close();
});

const req = (method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, token: string, payload?: object) =>
  c.app.inject({ method, url: `/api/v1${url}`, headers: auth(token), payload });

describe('supervisores', () => {
  it('cria, lista, detalha e altera', async () => {
    const r = await req('POST', '/supervisores', c.tokens.admin, { codigo: 'S9', nome: 'Novo Sup', email: '' });
    expect(r.statusCode).toBe(201);
    const id = r.json().id;
    const lista = await req('GET', '/supervisores?busca=novo', c.tokens.admin);
    expect(lista.json().total).toBe(1);
    const put = await req('PUT', `/supervisores/${id}`, c.tokens.admin, { codigo: 'S9', nome: 'Sup Alterado' });
    expect(put.json().nome).toBe('Sup Alterado');
    const det = await req('GET', `/supervisores/${c.supA.id}`, c.tokens.admin);
    expect(det.json().vendedores).toHaveLength(2);
  });

  it('código duplicado → 409', async () => {
    const r = await req('POST', '/supervisores', c.tokens.admin, { codigo: 'SA', nome: 'Dup' });
    expect(r.statusCode).toBe(409);
    expect(r.json().erro).toMatch(/código/);
  });
});

describe('vendedores', () => {
  it('cria vinculado a supervisor', async () => {
    const r = await req('POST', '/vendedores', c.tokens.admin, { codigo: 'V9', nome: 'Novo Vend', supervisorId: c.supB.id });
    expect(r.statusCode).toBe(201);
    expect(r.json().supervisor.nome).toBe('Supervisor B');
  });

  it('supervisor só vê vendedores da sua equipe', async () => {
    const r = await req('GET', '/vendedores', c.tokens.supervisor);
    const codigos = r.json().dados.map((v: { codigo: string }) => v.codigo).sort();
    expect(codigos).toEqual(['V1', 'V2']);
    const outro = await req('GET', `/vendedores/${c.vendOutraEquipe.id}`, c.tokens.supervisor);
    expect(outro.statusCode).toBe(404);
  });

  it('supervisor não cadastra', async () => {
    const r = await req('POST', '/vendedores', c.tokens.supervisor, { codigo: 'X', nome: 'Xx' });
    expect(r.statusCode).toBe(403);
  });
});

describe('clientes', () => {
  it('valida CPF/CNPJ', async () => {
    const r = await req('POST', '/clientes', c.tokens.admin, { codigo: 'C9', razaoSocial: 'Teste', cpfCnpj: '123' });
    expect(r.statusCode).toBe(400);
    expect(r.json().erro).toBe('CPF/CNPJ inválido');
  });

  it('cria com máscara e salva só dígitos; busca por CNPJ', async () => {
    const r = await req('POST', '/clientes', c.tokens.admin, {
      codigo: 'C9', razaoSocial: 'Padaria Y', cpfCnpj: '11.444.777/0001-61', uf: 'sp',
    });
    expect(r.statusCode).toBe(201);
    expect(r.json().cpfCnpj).toBe('11444777000161');
    expect(r.json().uf).toBe('SP');
    const busca = await req('GET', '/clientes?busca=11.444.777', c.tokens.admin);
    expect(busca.json().dados[0].codigo).toBe('C9');
  });

  it('inativa (sem exclusão física) e filtra por ativo', async () => {
    const r = await req('PATCH', `/clientes/${c.cliente.id}`, c.tokens.admin, { ativo: false });
    expect(r.json().ativo).toBe(false);
    const ativos = await req('GET', '/clientes?ativo=true', c.tokens.admin);
    expect(ativos.json().dados.every((x: { ativo: boolean }) => x.ativo)).toBe(true);
    await req('PATCH', `/clientes/${c.cliente.id}`, c.tokens.admin, { ativo: true });
  });

  it('supervisor consulta clientes', async () => {
    const r = await req('GET', '/clientes', c.tokens.supervisor);
    expect(r.statusCode).toBe(200);
  });
});

describe('produtos', () => {
  it('cria com preço decimal e retorna number', async () => {
    const r = await req('POST', '/produtos', c.tokens.admin, {
      codigo: 'P9', descricao: 'CAFÉ 500G', embalagem: 'CX C/ 20 UN', qtdPorCaixa: 20, precoUnitario: '17.90', estoque: '',
    });
    expect(r.statusCode).toBe(201);
    expect(r.json().precoUnitario).toBe(17.9);
    expect(r.json().estoque).toBeNull();
  });

  it('qtdPorCaixa inválida → 400', async () => {
    const r = await req('POST', '/produtos', c.tokens.admin, {
      codigo: 'P8', descricao: 'X', embalagem: 'UN', qtdPorCaixa: 0, precoUnitario: 1,
    });
    expect(r.statusCode).toBe(400);
  });
});

describe('usuários', () => {
  it('perfil VENDEDOR exige vínculo', async () => {
    const r = await req('POST', '/usuarios', c.tokens.admin, { nome: 'Novo', login: 'novo', senha: '123456', perfil: 'VENDEDOR' });
    expect(r.statusCode).toBe(400);
    expect(r.json().erro).toBe('Selecione o vendedor');
  });

  it('cria vendedor vinculado, não expõe senha, e impede vínculo duplicado', async () => {
    const v = await req('POST', '/vendedores', c.tokens.admin, { codigo: 'V20', nome: 'Vend 20' });
    const r = await req('POST', '/usuarios', c.tokens.admin, {
      nome: 'Vend 20', login: 'v20', senha: '123456', perfil: 'VENDEDOR', vendedorId: v.json().id,
      supervisorId: c.supA.id, // ignorado: perfil vendedor
    });
    expect(r.statusCode).toBe(201);
    expect(r.json().senhaHash).toBeUndefined();
    expect(r.json().supervisorId).toBeNull();
    const dup = await req('POST', '/usuarios', c.tokens.admin, {
      nome: 'Dup', login: 'v21', senha: '123456', perfil: 'VENDEDOR', vendedorId: v.json().id,
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().erro).toMatch(/vendedor já está vinculado/);
  });

  it('redefine senha e mostra dispositivos', async () => {
    const lista = await req('GET', '/usuarios?busca=v1', c.tokens.admin);
    const u = lista.json().dados.find((x: { login: string }) => x.login === 'v1');
    const r = await req('PATCH', `/usuarios/${u.id}/senha`, c.tokens.admin, { senha: 'nova123' });
    expect(r.statusCode).toBe(200);
    const login = await c.app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { login: 'v1', senha: 'nova123', origem: 'app' } });
    expect(login.statusCode).toBe(200);
    const det = await req('GET', `/usuarios/${u.id}`, c.tokens.admin);
    expect(det.json().dispositivos[0].deviceId).toBe('dev-v1');
  });

  it('admin não inativa a si mesmo', async () => {
    const lista = await req('GET', '/usuarios?busca=admin', c.tokens.admin);
    const r = await req('PATCH', `/usuarios/${lista.json().dados[0].id}`, c.tokens.admin, { ativo: false });
    expect(r.statusCode).toBe(400);
  });
});
