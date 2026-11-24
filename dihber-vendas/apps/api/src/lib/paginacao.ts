import type { ListagemQuery } from '@dihber/shared';

export function paginar(q: { pagina: number; porPagina: number }) {
  return { skip: (q.pagina - 1) * q.porPagina, take: q.porPagina };
}

export function filtroAtivo(q: ListagemQuery) {
  return q.ativo === undefined ? {} : { ativo: q.ativo };
}

export function contem(busca: string | undefined, campos: string[]) {
  if (!busca) return {};
  return { OR: campos.map((c) => ({ [c]: { contains: busca, mode: 'insensitive' as const } })) };
}
