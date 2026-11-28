import { z } from 'zod';
import { PERFIS } from '../enums';
import { validarCpfCnpj } from '../cpf-cnpj';
import { somenteDigitos } from '../formatacao';
import { emailOpcional, textoOpcional } from './comum';

/** '' → ausente (Campo obrigatório); texto não numérico → NaN (Informe um número válido). */
const numero = (v: unknown) => (v === '' || v === null || v === undefined ? undefined : Number(v));

const uuidOpcional = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.string().uuid().nullable(),
);
const listaIds = z
  .array(z.string().uuid())
  .max(1000)
  .default([])
  .transform((l) => [...new Set(l)]);

const codigo = z.string().trim().min(1, 'Informe o código').max(30);
const nome = z.string().trim().min(2, 'Informe o nome').max(150);

export const supervisorSchema = z.object({
  codigo,
  nome,
  email: emailOpcional,
  telefone: textoOpcional,
  ativo: z.boolean().default(true),
});
export type SupervisorInput = z.infer<typeof supervisorSchema>;

export const vendedorSchema = z.object({
  codigo,
  nome,
  email: emailOpcional,
  telefone: textoOpcional,
  supervisorId: z.preprocess((v) => (v === '' ? null : v), z.string().uuid().nullable().optional()),
  ativo: z.boolean().default(true),
});
export type VendedorInput = z.infer<typeof vendedorSchema>;

export const clienteSchema = z.object({
  codigo,
  razaoSocial: z.string().trim().min(2, 'Informe a razão social').max(200),
  nomeFantasia: textoOpcional,
  cpfCnpj: z.string().trim().transform(somenteDigitos).refine(validarCpfCnpj, 'CPF/CNPJ inválido'),
  telefone: textoOpcional,
  email: emailOpcional,
  endereco: textoOpcional,
  cidade: textoOpcional,
  uf: z.preprocess(
    (v) => (v === '' || v === null ? undefined : typeof v === 'string' ? v.toUpperCase() : v),
    z.string().length(2, 'UF deve ter 2 letras').optional(),
  ),
  ativo: z.boolean().default(true),
  /** Tabela de preço do cliente (vazio = preço base do produto). */
  tabelaPrecoId: uuidOpcional,
  /** Carteira: vendedores que podem vender para o cliente. */
  vendedorIds: listaIds,
  /** Prazos de boleto permitidos (PIX é sempre permitido). */
  prazoIds: listaIds,
});
export type ClienteInput = z.infer<typeof clienteSchema>;

export const produtoSchema = z.object({
  codigo,
  descricao: z.string().trim().min(2, 'Informe a descrição').max(200),
  embalagem: z.string().trim().min(1, 'Informe a embalagem').max(60),
  qtdPorCaixa: z.preprocess(numero, z.number().int('Deve ser inteiro').min(1, 'Mínimo 1')),
  precoUnitario: z.preprocess(numero, z.number().min(0, 'Preço inválido').max(9999999999)),
  estoque: z.preprocess((v) => numero(v) ?? null, z.number().nullable()),
  /** % de comissão do vendedor sobre o valor vendido (vazio = 0). */
  comissaoPercentual: z.preprocess(
    (v) => numero(v) ?? 0,
    z.number().min(0, 'Comissão inválida').max(100, 'Máximo 100%'),
  ),
  ativo: z.boolean().default(true),
});
export type ProdutoInput = z.infer<typeof produtoSchema>;

const usuarioBase = z.object({
  nome,
  login: z
    .string()
    .trim()
    .min(3, 'Mínimo 3 caracteres')
    .max(60)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Use apenas letras, números, ponto, hífen ou _')
    // logins são salvos sempre em minúsculas (o login não diferencia maiúsculas)
    .transform((v) => v.toLowerCase()),
  perfil: z.enum(PERFIS),
  ativo: z.boolean().default(true),
  vendedorId: z.preprocess((v) => (v === '' ? null : v), z.string().uuid().nullable().optional()),
  supervisorId: z.preprocess((v) => (v === '' ? null : v), z.string().uuid().nullable().optional()),
});

type UsuarioBase = z.infer<typeof usuarioBase>;
function validarVinculo(u: UsuarioBase, ctx: z.RefinementCtx) {
  if (u.perfil === 'VENDEDOR' && !u.vendedorId)
    ctx.addIssue({ code: 'custom', path: ['vendedorId'], message: 'Selecione o vendedor' });
  if (u.perfil === 'SUPERVISOR' && !u.supervisorId)
    ctx.addIssue({ code: 'custom', path: ['supervisorId'], message: 'Selecione o supervisor' });
}

export const senhaSchema = z.string().min(6, 'A senha deve ter ao menos 6 caracteres').max(100);

export const usuarioCriarSchema = usuarioBase
  .extend({ senha: senhaSchema })
  .superRefine(validarVinculo)
  .transform(normalizarVinculo);
export type UsuarioCriarInput = z.infer<typeof usuarioCriarSchema>;

export const usuarioAtualizarSchema = usuarioBase
  .superRefine(validarVinculo)
  .transform(normalizarVinculo);
export type UsuarioAtualizarInput = z.infer<typeof usuarioAtualizarSchema>;

export const usuarioSenhaSchema = z.object({ senha: senhaSchema });

export const ativoSchema = z.object({ ativo: z.boolean() });

/** Garante que só o vínculo compatível com o perfil fica preenchido. */
function normalizarVinculo<T extends UsuarioBase>(u: T): T {
  return {
    ...u,
    vendedorId: u.perfil === 'VENDEDOR' ? u.vendedorId : null,
    supervisorId: u.perfil === 'SUPERVISOR' ? u.supervisorId : null,
  };
}

export const tabelaPrecoSchema = z.object({
  codigo,
  nome: z.string().trim().min(2, 'Informe o nome').max(100),
  cidade: textoOpcional,
  uf: z.preprocess(
    (v) => (v === '' || v === null ? undefined : typeof v === 'string' ? v.toUpperCase() : v),
    z.string().length(2, 'UF deve ter 2 letras').optional(),
  ),
  ativo: z.boolean().default(true),
});
export type TabelaPrecoInput = z.infer<typeof tabelaPrecoSchema>;

/** Alteração de preços de uma tabela: preco null remove o produto da tabela (volta ao preço base). */
export const tabelaPrecoItensSchema = z.object({
  itens: z
    .array(
      z.object({
        produtoId: z.string().uuid(),
        preco: z.preprocess(
          (v) => (v === '' || v === undefined ? null : v),
          z.number().min(0, 'Preço inválido').max(9999999999).nullable(),
        ),
      }),
    )
    .max(20000),
});

export const prazoPagamentoSchema = z.object({
  codigo,
  descricao: z.string().trim().min(1, 'Informe a descrição').max(60),
  ativo: z.boolean().default(true),
});
export type PrazoPagamentoInput = z.infer<typeof prazoPagamentoSchema>;
