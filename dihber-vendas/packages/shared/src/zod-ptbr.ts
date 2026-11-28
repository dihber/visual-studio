import { z, ZodIssueCode, type ZodErrorMap } from 'zod';

/** Mensagens padrão do Zod em português (aplicado globalmente ao importar o pacote shared). */
export const mapaErrosPtBr: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null')
        return { message: 'Campo obrigatório' };
      if (issue.expected === 'number') return { message: 'Informe um número válido' };
      return { message: 'Valor inválido' };
    case ZodIssueCode.too_small:
      if (issue.type === 'string')
        return {
          message:
            issue.minimum === 1 ? 'Campo obrigatório' : `Mínimo de ${issue.minimum} caracteres`,
        };
      if (issue.type === 'array') return { message: `Informe ao menos ${issue.minimum} item(ns)` };
      return { message: `Valor mínimo: ${issue.minimum}` };
    case ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `Máximo de ${issue.maximum} caracteres` };
      if (issue.type === 'array') return { message: `Máximo de ${issue.maximum} itens` };
      return { message: `Valor máximo: ${issue.maximum}` };
    case ZodIssueCode.invalid_enum_value:
      return { message: 'Selecione uma opção válida' };
    case ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: 'E-mail inválido' };
      if (issue.validation === 'uuid') return { message: 'Identificador inválido' };
      if (issue.validation === 'datetime' || issue.validation === 'date')
        return { message: 'Data inválida' };
      return { message: 'Formato inválido' };
  }
  return { message: ctx.defaultError };
};

z.setErrorMap(mapaErrosPtBr);
