import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { ErroHttp } from '../lib/erros';

const CAMPOS_UNICOS: Record<string, string> = {
  codigo: 'Já existe um registro com este código',
  login: 'Este login já está em uso',
  cpfCnpj: 'Já existe um cliente com este CPF/CNPJ',
  vendedorId: 'Este vendedor já está vinculado a outro usuário',
  supervisorId: 'Este supervisor já está vinculado a outro usuário',
};

export function registrarTratamentoErros(app: FastifyInstance) {
  app.setErrorHandler((erro: Error & { statusCode?: number }, req, reply) => {
    if (erro instanceof ZodError) {
      const campos = erro.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message }));
      return reply.status(400).send({ erro: campos[0]?.mensagem ?? 'Dados inválidos', campos });
    }
    if (erro instanceof ErroHttp) {
      return reply.status(erro.statusCode).send({ erro: erro.message, detalhes: erro.detalhes });
    }
    if (erro instanceof Prisma.PrismaClientKnownRequestError) {
      if (erro.code === 'P2002') {
        const alvo = ([] as string[]).concat((erro.meta?.target as string[] | string) ?? []);
        const campo = alvo.find((c) => CAMPOS_UNICOS[c]);
        return reply
          .status(409)
          .send({ erro: campo ? CAMPOS_UNICOS[campo] : 'Registro duplicado', campo });
      }
      if (erro.code === 'P2025') return reply.status(404).send({ erro: 'Registro não encontrado' });
      if (erro.code === 'P2003')
        return reply.status(400).send({ erro: 'Registro relacionado inválido' });
    }
    const status = (erro as { statusCode?: number }).statusCode;
    if (status && status < 500) {
      const msg =
        status === 429 ? 'Muitas tentativas. Aguarde um minuto e tente novamente.' : erro.message;
      return reply.status(status).send({ erro: msg });
    }
    req.log.error(
      { err: erro, usuario: req.usuario?.id, rota: req.routeOptions?.url, metodo: req.method },
      'Erro interno',
    );
    return reply.status(500).send({ erro: 'Erro interno no servidor' });
  });

  app.setNotFoundHandler((_req, reply) => reply.status(404).send({ erro: 'Rota não encontrada' }));
}
