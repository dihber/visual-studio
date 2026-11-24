import { useQuery } from '@tanstack/react-query';
import { http } from '@/api/cliente';
import type { Paginado } from '@/api/tipos';

interface Basico {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
}

/** Lista simples (até 500) para combos de seleção. */
export function useOpcoes(endpoint: '/supervisores' | '/vendedores', habilitado = true) {
  const q = useQuery({
    queryKey: [endpoint, 'opcoes'],
    queryFn: () => http.get<Paginado<Basico>>(endpoint, { porPagina: 500, ativo: 'todos' }),
    enabled: habilitado,
    staleTime: 60_000,
  });
  const lista = q.data?.dados ?? [];
  return {
    lista,
    opcoes: lista
      .filter((x) => x.ativo)
      .map((x) => ({ valor: x.id, label: `${x.codigo} - ${x.nome}` })),
    /** inclui inativos (para não perder o valor atual na edição) */
    todasOpcoes: lista.map((x) => ({ valor: x.id, label: `${x.codigo} - ${x.nome}${x.ativo ? '' : ' (inativo)'}` })),
  };
}
