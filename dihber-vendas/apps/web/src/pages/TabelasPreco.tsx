import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Tags } from 'lucide-react';
import { formatarMoeda, tabelaPrecoSchema } from '@dihber/shared';
import { http } from '@/api/cliente';
import type { ItemTabelaPreco, TabelaPreco } from '@/api/tipos';
import { PaginaCadastro } from '@/components/PaginaCadastro';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Alerta } from '@/components/ui/alerta';
import { LinhaVazia, Td, Th } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';

const UFS =
  'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const LIMITE_LINHAS = 300;

const paraTexto = (n: number | null) => (n === null ? '' : n.toFixed(2).replace('.', ','));
const paraNumero = (s: string): number | null | 'invalido' => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 'invalido';
};

export function TabelasPreco() {
  const [precosDe, setPrecosDe] = useState<TabelaPreco | null>(null);
  return (
    <>
      <PaginaCadastro<TabelaPreco>
        titulo="Tabelas de preço"
        subtitulo="Preço por região. Produto sem preço na tabela usa o preço base do cadastro de produtos."
        endpoint="/tabelas-preco"
        nomeItem="tabela"
        genero="f"
        placeholderBusca="Buscar por código, nome, cidade ou UF..."
        colunas={[
          { titulo: 'Código', render: (t) => <span className="font-mono">{t.codigo}</span> },
          { titulo: 'Nome', render: (t) => <span className="font-medium">{t.nome}</span> },
          { titulo: 'Região', render: (t) => [t.cidade, t.uf].filter(Boolean).join(' / ') || '-' },
          {
            titulo: 'Produtos com preço',
            render: (t) => t._count?.itens ?? 0,
            className: 'text-right',
          },
          { titulo: 'Clientes', render: (t) => t._count?.clientes ?? 0, className: 'text-right' },
        ]}
        campos={[
          { nome: 'codigo', label: 'Código', obrigatorio: true, largura: 'terco', maxLength: 30 },
          {
            nome: 'nome',
            label: 'Nome',
            obrigatorio: true,
            largura: 'inteira',
            placeholder: 'Ex.: Itupeva/SP, Cuiabá/MT',
          },
          { nome: 'cidade', label: 'Cidade', largura: 'metade' },
          {
            nome: 'uf',
            label: 'UF',
            tipo: 'select',
            largura: 'metade',
            opcoes: UFS.map((u) => ({ valor: u, label: u })),
          },
          { nome: 'ativo', label: 'Ativa', tipo: 'ativo' },
        ]}
        schemaCriar={tabelaPrecoSchema}
        valoresIniciais={{ ativo: true }}
        paraFormulario={(t) => ({ ...t, cidade: t.cidade ?? '', uf: t.uf ?? '' })}
        acoesExtras={(t) => (
          <Button variante="fantasma" tamanho="icone" title="Preços" onClick={() => setPrecosDe(t)}>
            <Tags className="h-4 w-4" />
          </Button>
        )}
      />
      {precosDe && <DialogPrecos tabela={precosDe} aoFechar={() => setPrecosDe(null)} />}
    </>
  );
}

function DialogPrecos({ tabela, aoFechar }: { tabela: TabelaPreco; aoFechar: () => void }) {
  const { ehAdmin } = useAuth();
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [somenteComPreco, setSomenteComPreco] = useState(false);
  const [alterados, setAlterados] = useState<Record<string, string>>({});
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(false);

  const q = useQuery({
    queryKey: ['/tabelas-preco', tabela.id, 'itens'],
    queryFn: () => http.get<ItemTabelaPreco[]>(`/tabelas-preco/${tabela.id}/itens`),
  });

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (q.data ?? []).filter(
      (i) =>
        (!t || i.codigo.toLowerCase().includes(t) || i.descricao.toLowerCase().includes(t)) &&
        (!somenteComPreco || i.preco !== null || alterados[i.produtoId] !== undefined),
    );
  }, [q.data, busca, somenteComPreco, alterados]);

  const salvar = useMutation({
    mutationFn: () => {
      const itens: { produtoId: string; preco: number | null }[] = [];
      for (const [produtoId, texto] of Object.entries(alterados)) {
        const n = paraNumero(texto);
        if (n === 'invalido') throw new Error('Há preços inválidos. Use o formato 10,90.');
        itens.push({ produtoId, preco: n });
      }
      return http.put(`/tabelas-preco/${tabela.id}/itens`, { itens });
    },
    onSuccess: () => {
      setAlterados({});
      setSalvo(true);
      qc.invalidateQueries({ queryKey: ['/tabelas-preco'] });
    },
    onError: (e) => setErro(e.message),
  });

  const qtdAlterados = Object.keys(alterados).length;

  return (
    <Dialog
      aberto
      aoFechar={aoFechar}
      titulo={`Preços — ${tabela.nome}`}
      largura="max-w-4xl"
      rodape={
        ehAdmin ? (
          <>
            <Button variante="secundario" onClick={aoFechar}>
              Fechar
            </Button>
            <Button
              onClick={() => {
                setErro('');
                setSalvo(false);
                salvar.mutate();
              }}
              carregando={salvar.isPending}
              disabled={qtdAlterados === 0}
            >
              Salvar {qtdAlterados > 0 ? `(${qtdAlterados})` : ''}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Deixe em branco para usar o preço base do produto. Os celulares recebem os preços novos na
          próxima sincronização.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="max-w-sm"
            placeholder="Buscar produto por código ou descrição..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue-600"
              checked={somenteComPreco}
              onChange={(e) => setSomenteComPreco(e.target.checked)}
            />
            Só produtos com preço nesta tabela
          </label>
        </div>
        {erro && <Alerta>{erro}</Alerta>}
        {salvo && <p className="text-sm text-emerald-700">Preços salvos.</p>}
        <div className="max-h-[55vh] overflow-y-auto rounded-md border border-slate-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr>
                <Th>Código</Th>
                <Th>Produto</Th>
                <Th className="text-right">Preço base</Th>
                <Th className="w-40">Preço na tabela (UN)</Th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <LinhaVazia
                  colunas={4}
                  carregando={q.isLoading}
                  mensagem="Nenhum produto encontrado"
                />
              ) : (
                filtrados.slice(0, LIMITE_LINHAS).map((i) => {
                  const texto = alterados[i.produtoId] ?? paraTexto(i.preco);
                  const invalido = paraNumero(texto) === 'invalido';
                  return (
                    <tr
                      key={i.produtoId}
                      className={alterados[i.produtoId] !== undefined ? 'bg-amber-50' : undefined}
                    >
                      <Td className="font-mono">{i.codigo}</Td>
                      <Td>
                        <div className="font-medium">{i.descricao}</div>
                        <div className="text-xs text-slate-500">{i.embalagem}</div>
                      </Td>
                      <Td className="whitespace-nowrap text-right text-slate-500">
                        {formatarMoeda(i.precoBase)}
                      </Td>
                      <Td>
                        <Input
                          inputMode="decimal"
                          disabled={!ehAdmin}
                          value={texto}
                          placeholder="Preço base"
                          aria-label={`Preço de ${i.descricao}`}
                          className={invalido ? 'h-9 border-red-400' : 'h-9'}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^\d,.]/g, '');
                            setSalvo(false);
                            setAlterados((s) => {
                              const original = paraTexto(i.preco);
                              const novo = { ...s };
                              if (v === original) delete novo[i.produtoId];
                              else novo[i.produtoId] = v;
                              return novo;
                            });
                          }}
                        />
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filtrados.length > LIMITE_LINHAS && (
          <p className="text-xs text-slate-500">
            Mostrando {LIMITE_LINHAS} de {filtrados.length} produtos. Use a busca para encontrar os
            demais.
          </p>
        )}
      </div>
    </Dialog>
  );
}
