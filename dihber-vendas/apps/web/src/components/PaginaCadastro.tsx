import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Pencil, Plus, Power, Search } from 'lucide-react';
import type { ZodTypeAny } from 'zod';
import { http, ErroApi } from '@/api/cliente';
import type { Paginado } from '@/api/tipos';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/hooks/useAuth';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Campo, Checkbox, Input, Select } from './ui/input';
import { Dialog } from './ui/dialog';
import { LinhaVazia, Paginacao, Tabela, Td, Th } from './ui/table';
import { Alerta } from './ui/alerta';
import { BadgeAtivo } from './ui/badge';
import { cn } from '@/lib/utils';

export type Valores = Record<string, unknown>;

export interface CampoForm {
  nome: string;
  label: string;
  tipo?: 'texto' | 'email' | 'numero' | 'decimal' | 'senha' | 'select' | 'ativo';
  opcoes?: { valor: string; label: string }[];
  obrigatorio?: boolean;
  placeholder?: string;
  maxLength?: number;
  largura?: 'metade' | 'inteira' | 'terco';
  /** Mostra o campo apenas quando a função retornar true. */
  visivel?: (v: Valores, editando: boolean) => boolean;
  ajuda?: string;
}

export interface Coluna<T> {
  titulo: string;
  render: (r: T) => ReactNode;
  className?: string;
}

interface Props<T extends { id: string; ativo: boolean }> {
  titulo: string;
  subtitulo?: string;
  endpoint: string;
  nomeItem: string;
  colunas: Coluna<T>[];
  campos: CampoForm[];
  schemaCriar: ZodTypeAny;
  schemaEditar?: ZodTypeAny;
  valoresIniciais: Valores;
  paraFormulario: (r: T) => Valores;
  acoesExtras?: (r: T) => ReactNode;
  placeholderBusca?: string;
  /** Ajusta os valores antes de validar/enviar (ex.: "17,90" → 17.9). */
  paraEnvio?: (v: Valores) => Valores;
}

export function PaginaCadastro<T extends { id: string; ativo: boolean }>(p: Props<T>) {
  const { ehAdmin } = useAuth();
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState<'true' | 'false' | 'todos'>('true');
  const [pagina, setPagina] = useState(1);
  const buscaDeb = useDebounce(busca);

  const [editando, setEditando] = useState<T | null>(null);
  const [aberto, setAberto] = useState(false);
  const [valores, setValores] = useState<Valores>(p.valoresIniciais);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState('');

  const consulta = useQuery({
    queryKey: [p.endpoint, { busca: buscaDeb, ativo, pagina }],
    queryFn: () => http.get<Paginado<T>>(p.endpoint, { busca: buscaDeb, ativo, pagina, porPagina: 20 }),
    placeholderData: keepPreviousData,
  });

  const salvar = useMutation({
    mutationFn: (dados: Valores) =>
      editando ? http.put<T>(`${p.endpoint}/${editando.id}`, dados) : http.post<T>(p.endpoint, dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [p.endpoint] });
      setAberto(false);
    },
    onError: (e) => {
      if (e instanceof ErroApi && e.campos?.length) {
        setErros(Object.fromEntries(e.campos.map((c) => [c.campo, c.mensagem])));
      }
      setErroGeral(e.message);
    },
  });

  const alternarAtivo = useMutation({
    mutationFn: (r: T) => http.patch<T>(`${p.endpoint}/${r.id}`, { ativo: !r.ativo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [p.endpoint] }),
    onError: (e) => alert(e.message),
  });

  const abrir = (r: T | null) => {
    setEditando(r);
    setValores(r ? p.paraFormulario(r) : p.valoresIniciais);
    setErros({});
    setErroGeral('');
    setAberto(true);
  };

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    setErroGeral('');
    const schema = editando && p.schemaEditar ? p.schemaEditar : p.schemaCriar;
    const dadosEnvio = p.paraEnvio ? p.paraEnvio(valores) : valores;
    const r = schema.safeParse(dadosEnvio);
    if (!r.success) {
      const errs: Record<string, string> = {};
      for (const i of r.error.issues) errs[String(i.path[0])] ??= i.message;
      setErros(errs);
      return;
    }
    setErros({});
    salvar.mutate(dadosEnvio);
  };

  const camposVisiveis = p.campos.filter((c) => !c.visivel || c.visivel(valores, !!editando));
  const dados = consulta.data?.dados ?? [];
  const totalColunas = p.colunas.length + 2;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{p.titulo}</h1>
          {p.subtitulo && <p className="text-sm text-slate-500">{p.subtitulo}</p>}
        </div>
        {ehAdmin && (
          <Button onClick={() => abrir(null)}>
            <Plus className="h-4 w-4" /> Novo {p.nomeItem}
          </Button>
        )}
      </div>

      <Card>
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder={p.placeholderBusca ?? 'Buscar por código ou nome...'}
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
            />
          </div>
          <Select
            className="w-40"
            value={ativo}
            onChange={(e) => {
              setAtivo(e.target.value as typeof ativo);
              setPagina(1);
            }}
          >
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
            <option value="todos">Todos</option>
          </Select>
        </div>
        <Tabela>
          <thead>
            <tr>
              {p.colunas.map((c) => (
                <Th key={c.titulo} className={c.className}>
                  {c.titulo}
                </Th>
              ))}
              <Th>Situação</Th>
              <Th className="text-right">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {dados.length === 0 ? (
              <LinhaVazia colunas={totalColunas} carregando={consulta.isLoading} />
            ) : (
              dados.map((r) => (
                <tr key={r.id} className={cn('hover:bg-slate-50', !r.ativo && 'text-slate-400')}>
                  {p.colunas.map((c) => (
                    <Td key={c.titulo} className={c.className}>
                      {c.render(r)}
                    </Td>
                  ))}
                  <Td>
                    <BadgeAtivo ativo={r.ativo} />
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <div className="inline-flex gap-1">
                      {p.acoesExtras?.(r)}
                      {ehAdmin && (
                        <>
                          <Button variante="fantasma" tamanho="icone" title="Editar" onClick={() => abrir(r)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variante="fantasma"
                            tamanho="icone"
                            title={r.ativo ? 'Inativar' : 'Ativar'}
                            onClick={() => {
                              if (!r.ativo || confirm(`Inativar este ${p.nomeItem}?`)) alternarAtivo.mutate(r);
                            }}
                          >
                            <Power className={cn('h-4 w-4', r.ativo ? 'text-red-500' : 'text-emerald-600')} />
                          </Button>
                        </>
                      )}
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Tabela>
        {consulta.data && (
          <Paginacao pagina={pagina} porPagina={consulta.data.porPagina} total={consulta.data.total} aoMudar={setPagina} />
        )}
        {consulta.error && (
          <div className="p-4">
            <Alerta>{consulta.error.message}</Alerta>
          </div>
        )}
      </Card>

      <Dialog
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={editando ? `Editar ${p.nomeItem}` : `Novo ${p.nomeItem}`}
        largura="max-w-2xl"
        rodape={
          <>
            <Button variante="secundario" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-cadastro" carregando={salvar.isPending}>
              Salvar
            </Button>
          </>
        }
      >
        <form id="form-cadastro" onSubmit={enviar} className="grid grid-cols-6 gap-4" noValidate>
          {camposVisiveis.map((c) => (
            <CampoFormulario
              key={c.nome}
              campo={c}
              valor={valores[c.nome]}
              erro={erros[c.nome]}
              aoMudar={(v) => setValores((s) => ({ ...s, [c.nome]: v }))}
            />
          ))}
          {erroGeral && (
            <div className="col-span-6">
              <Alerta>{erroGeral}</Alerta>
            </div>
          )}
        </form>
      </Dialog>
    </div>
  );
}

function CampoFormulario({
  campo: c,
  valor,
  erro,
  aoMudar,
}: {
  campo: CampoForm;
  valor: unknown;
  erro?: string;
  aoMudar: (v: unknown) => void;
}) {
  const span = c.largura === 'inteira' ? 'col-span-6' : c.largura === 'terco' ? 'col-span-6 sm:col-span-2' : 'col-span-6 sm:col-span-3';
  if (c.tipo === 'ativo') {
    return (
      <div className="col-span-6">
        <Checkbox label={c.label} checked={Boolean(valor)} onChange={aoMudar} />
      </div>
    );
  }
  return (
    <Campo label={c.label} erro={erro} obrigatorio={c.obrigatorio} className={span}>
      {c.tipo === 'select' ? (
        <Select value={String(valor ?? '')} onChange={(e) => aoMudar(e.target.value)} aria-invalid={!!erro}>
          <option value="">Selecione...</option>
          {c.opcoes?.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.label}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          type={c.tipo === 'senha' ? 'password' : c.tipo === 'email' ? 'email' : 'text'}
          inputMode={c.tipo === 'numero' ? 'numeric' : c.tipo === 'decimal' ? 'decimal' : undefined}
          value={String(valor ?? '')}
          maxLength={c.maxLength}
          placeholder={c.placeholder}
          aria-invalid={!!erro}
          className={erro ? 'border-red-400' : undefined}
          onChange={(e) => {
            const v = e.target.value;
            aoMudar(c.tipo === 'decimal' ? v.replace(/[^\d,.]/g, '') : c.tipo === 'numero' ? v.replace(/\D/g, '') : v);
          }}
        />
      )}
      {c.ajuda && !erro && <p className="mt-1 text-xs text-slate-500">{c.ajuda}</p>}
    </Campo>
  );
}
