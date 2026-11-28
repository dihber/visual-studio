import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, ExternalLink, Loader2, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { formatarDataHora } from '@dihber/shared';
import { http } from '@/api/cliente';
import type { AppBuild, StatusBuildApp } from '@/api/tipos';
import { useAuth } from '@/hooks/useAuth';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { Badge } from './ui/badge';
import { Alerta } from './ui/alerta';

const STATUS: Record<
  StatusBuildApp,
  { texto: string; cor: 'amarelo' | 'azul' | 'verde' | 'vermelho' }
> = {
  NA_FILA: { texto: 'Na fila', cor: 'amarelo' },
  GERANDO: { texto: 'Gerando…', cor: 'azul' },
  CONCLUIDO: { texto: 'Pronto', cor: 'verde' },
  FALHOU: { texto: 'Falhou', cor: 'vermelho' },
};

const emAndamento = (b?: AppBuild) => b?.status === 'NA_FILA' || b?.status === 'GERANDO';

/** Botão "Gerar APK" (admin) / "App Android" (supervisor) com a janela de builds e QR code. */
export function BotaoAppAndroid() {
  const { ehAdmin } = useAuth();
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button variante="secundario" onClick={() => setAberto(true)}>
        <Smartphone className="h-4 w-4" /> {ehAdmin ? 'Gerar APK' : 'App Android'}
      </Button>
      {aberto && <DialogAppAndroid aoFechar={() => setAberto(false)} />}
    </>
  );
}

function DialogAppAndroid({ aoFechar }: { aoFechar: () => void }) {
  const { ehAdmin } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['/app-builds'],
    queryFn: () => http.get<{ configurado: boolean; builds: AppBuild[] }>('/app-builds'),
    // enquanto gera, atualiza sozinho a cada 15 s
    refetchInterval: (query) => (emAndamento(query.state.data?.builds[0]) ? 15_000 : false),
  });
  const gerar = useMutation({
    mutationFn: () => http.post<AppBuild>('/app-builds'),
    onSettled: () => qc.invalidateQueries({ queryKey: ['/app-builds'] }),
  });

  const builds = q.data?.builds ?? [];
  const atual = builds[0];
  const ultimoPronto = builds.find((b) => b.status === 'CONCLUIDO');

  return (
    <Dialog aberto aoFechar={aoFechar} titulo="Aplicativo Android" largura="max-w-2xl">
      <div className="space-y-5">
        {q.isLoading && <p className="text-sm text-slate-500">Carregando…</p>}
        {q.error && <Alerta>{q.error.message}</Alerta>}

        {q.data && !q.data.configurado && (
          <Alerta>
            A geração de APK ainda não foi configurada. Falta a variável GITHUB_TOKEN_APK na API
            (Railway) e o secret EXPO_TOKEN no GitHub.
          </Alerta>
        )}

        {emAndamento(atual) && (
          <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
            <div>
              <p className="font-medium">
                {atual!.status === 'NA_FILA' ? 'Na fila para gerar o APK…' : 'Gerando o APK…'}
              </p>
              <p>
                Leva de 15 a 20 minutos. Pode fechar esta janela: o APK aparece aqui quando ficar
                pronto.
              </p>
              {atual!.githubRunUrl && (
                <a
                  href={atual!.githubRunUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 underline"
                >
                  Acompanhar no GitHub <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {atual?.status === 'FALHOU' && <Alerta>Último pedido falhou: {atual.erro}</Alerta>}
        {gerar.error && <Alerta>{gerar.error.message}</Alerta>}

        {ultimoPronto?.urlDownload && <Pronto build={ultimoPronto} />}

        {!ultimoPronto && !emAndamento(atual) && q.data?.configurado && (
          <p className="text-sm text-slate-500">Nenhum APK gerado pelo portal ainda.</p>
        )}

        {ehAdmin && (
          <div className="flex justify-end">
            <Button
              onClick={() => gerar.mutate()}
              carregando={gerar.isPending}
              disabled={!q.data?.configurado || emAndamento(atual)}
            >
              <Smartphone className="h-4 w-4" /> {ultimoPronto ? 'Gerar novo APK' : 'Gerar APK'}
            </Button>
          </div>
        )}

        {builds.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Histórico</h3>
            <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 text-sm">
              {builds.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{formatarDataHora(b.solicitadoEm)}</span>
                    <span className="text-slate-500"> · {b.solicitadoPor.nome}</span>
                    {b.versao && <span className="text-slate-500"> · versão {b.versao}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge cor={STATUS[b.status].cor}>{STATUS[b.status].texto}</Badge>
                    {b.githubRunUrl && (
                      <a
                        href={b.githubRunUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Ver no GitHub"
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function Pronto({ build }: { build: AppBuild }) {
  const [qr, setQr] = useState('');
  useEffect(() => {
    QRCode.toDataURL(build.urlDownload!, { width: 220, margin: 1 }).then(setQr, () => setQr(''));
  }, [build.urlDownload]);

  return (
    <div className="flex flex-col items-center gap-5 rounded-md border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-start">
      {qr ? (
        <img src={qr} alt="QR code para baixar o APK" className="h-44 w-44 rounded bg-white p-1" />
      ) : (
        <div className="h-44 w-44 rounded bg-white" />
      )}
      <div className="space-y-2 text-sm text-emerald-900">
        <p className="text-base font-semibold">
          APK pronto{build.versao ? ` — versão ${build.versao}` : ''}
        </p>
        <p>Gerado em {formatarDataHora(build.concluidoEm ?? build.solicitadoEm)}.</p>
        <p>
          No celular Android, aponte a câmera para o QR code, baixe e instale. Se o Android pedir,
          permita “instalar apps desconhecidos”.
        </p>
        <a href={build.urlDownload!} target="_blank" rel="noreferrer">
          <Button variante="sucesso" tamanho="sm" className="mt-1">
            <Download className="h-4 w-4" /> Baixar APK
          </Button>
        </a>
      </div>
    </div>
  );
}
