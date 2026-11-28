/** Normaliza texto para busca: minúsculas e sem acentos. */
export function normalizar(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Converte "1,5" ou "1.5" em número (NaN se inválido). */
export function lerNumero(s: string): number {
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return NaN;
  return Number(t);
}

export function formatarNumeroEntrada(n: number): string {
  return String(n).replace('.', ',');
}
