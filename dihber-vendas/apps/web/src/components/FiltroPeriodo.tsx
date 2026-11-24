import { Input } from './ui/input';
import { hojeISO, inicioDoMesISO } from '@/lib/utils';

export function FiltroPeriodo({
  inicio,
  fim,
  aoMudar,
}: {
  inicio: string;
  fim: string;
  aoMudar: (inicio: string, fim: string) => void;
}) {
  const atalho = (i: string, f: string, label: string) => (
    <button
      type="button"
      onClick={() => aoMudar(i, f)}
      className={`rounded px-2 py-1 text-xs ${inicio === i && fim === f ? 'bg-blue-50 text-primary font-medium' : 'text-slate-500 hover:bg-slate-100'}`}
    >
      {label}
    </button>
  );
  const hoje = hojeISO();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="date"
        className="w-40"
        value={inicio}
        max={fim || undefined}
        onChange={(e) => aoMudar(e.target.value, fim)}
        aria-label="Data inicial"
      />
      <span className="text-sm text-slate-400">até</span>
      <Input
        type="date"
        className="w-40"
        value={fim}
        min={inicio || undefined}
        onChange={(e) => aoMudar(inicio, e.target.value)}
        aria-label="Data final"
      />
      <div className="flex gap-1">
        {atalho(hoje, hoje, 'Hoje')}
        {atalho(inicioDoMesISO(), hoje, 'Este mês')}
        {atalho('', '', 'Tudo')}
      </div>
    </div>
  );
}
