export const TZ_BRASILIA = 'America/Sao_Paulo';

export function formatarMoeda(valor: number | string | null | undefined): string {
  const n = Number(valor ?? 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarQuantidade(valor: number | string | null | undefined): string {
  return Number(valor ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

export function formatarDataHora(data: string | Date | null | undefined): string {
  if (!data) return '-';
  return new Date(data).toLocaleString('pt-BR', {
    timeZone: TZ_BRASILIA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatarData(data: string | Date | null | undefined): string {
  if (!data) return '-';
  return new Date(data).toLocaleDateString('pt-BR', { timeZone: TZ_BRASILIA });
}

export function somenteDigitos(v: string): string {
  return v.replace(/\D/g, '');
}

export function formatarCpfCnpj(v: string): string {
  const d = somenteDigitos(v);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return v;
}

/**
 * Deixa legível o sistema do aparelho. Versões antigas do app gravavam no Android o
 * "fingerprint" interno (ex.: "samsung/beyond0ltexx/beyond0:12/SP1A.../...:user/release-keys"),
 * que vira "Android 12".
 */
export function formatarSistema(sistema: string | null | undefined): string | null {
  if (!sistema) return null;
  const fingerprint = sistema.match(/^[^/\s]+\/[^/\s]+\/[^:\s]+:([\d.]+)\//);
  return fingerprint ? `Android ${fingerprint[1]}` : sistema;
}
