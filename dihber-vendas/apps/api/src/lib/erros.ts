export class ErroHttp extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public detalhes?: unknown,
  ) {
    super(message);
  }
}

export const naoEncontrado = (o = 'Registro') => new ErroHttp(404, `${o} não encontrado`);
export const proibido = (m = 'Acesso negado') => new ErroHttp(403, m);
export const requisicaoInvalida = (m: string, d?: unknown) => new ErroHttp(400, m, d);
