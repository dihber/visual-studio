import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { KeyRound, Smartphone } from 'lucide-react';
import {
  PERFIL_LABEL,
  PERFIS,
  formatarDataHora,
  usuarioAtualizarSchema,
  usuarioCriarSchema,
  usuarioSenhaSchema,
} from '@dihber/shared';
import { z } from 'zod';
import { http } from '@/api/cliente';
import type { Usuario } from '@/api/tipos';
import { PaginaCadastro } from '@/components/PaginaCadastro';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Campo, Input } from '@/components/ui/input';
import { Alerta } from '@/components/ui/alerta';
import { Tabela, Td, Th, LinhaVazia } from '@/components/ui/table';
import { useOpcoes } from '@/hooks/useOpcoes';

/** Valida o cadastro com o schema compartilhado + confirmação de senha. */
const schemaCriar = z.record(z.unknown()).superRefine((u, ctx) => {
  const r = usuarioCriarSchema.safeParse(u);
  if (!r.success)
    r.error.issues.forEach((i) =>
      ctx.addIssue({ code: 'custom', path: i.path, message: i.message }),
    );
  // vínculo validado já de início (o superRefine do schema só roda quando o resto está válido)
  if (u.perfil === 'VENDEDOR' && !u.vendedorId)
    ctx.addIssue({ code: 'custom', path: ['vendedorId'], message: 'Selecione o vendedor' });
  if (u.perfil === 'SUPERVISOR' && !u.supervisorId)
    ctx.addIssue({ code: 'custom', path: ['supervisorId'], message: 'Selecione o supervisor' });
  if (u.senha !== u.confirmarSenha)
    ctx.addIssue({ code: 'custom', path: ['confirmarSenha'], message: 'As senhas não conferem' });
});

const corPerfil = { ADMIN: 'vermelho', SUPERVISOR: 'azul', VENDEDOR: 'verde' } as const;

export function Usuarios() {
  const vendedores = useOpcoes('/vendedores');
  const supervisores = useOpcoes('/supervisores');
  const [senhaDe, setSenhaDe] = useState<Usuario | null>(null);
  const [dispositivosDe, setDispositivosDe] = useState<Usuario | null>(null);

  return (
    <>
      <PaginaCadastro<Usuario>
        titulo="Usuários"
        endpoint="/usuarios"
        nomeItem="usuário"
        placeholderBusca="Buscar por nome ou login..."
        colunas={[
          { titulo: 'Nome', render: (u) => <span className="font-medium">{u.nome}</span> },
          { titulo: 'Login', render: (u) => <span className="font-mono">{u.login}</span> },
          {
            titulo: 'Perfil',
            render: (u) => <Badge cor={corPerfil[u.perfil]}>{PERFIL_LABEL[u.perfil]}</Badge>,
          },
          {
            titulo: 'Vínculo',
            render: (u) =>
              u.vendedor
                ? `Vendedor: ${u.vendedor.codigo} - ${u.vendedor.nome}`
                : u.supervisor
                  ? `Supervisor: ${u.supervisor.nome}`
                  : '-',
          },
        ]}
        campos={[
          { nome: 'nome', label: 'Nome', obrigatorio: true, largura: 'inteira' },
          { nome: 'login', label: 'Login', obrigatorio: true, largura: 'metade' },
          {
            nome: 'perfil',
            label: 'Perfil',
            tipo: 'select',
            obrigatorio: true,
            largura: 'metade',
            opcoes: PERFIS.map((p) => ({ valor: p, label: PERFIL_LABEL[p] })),
          },
          {
            nome: 'vendedorId',
            label: 'Qual vendedor?',
            tipo: 'select',
            obrigatorio: true,
            largura: 'inteira',
            opcoes: vendedores.todasOpcoes,
            visivel: (v) => v.perfil === 'VENDEDOR',
          },
          {
            nome: 'supervisorId',
            label: 'Qual supervisor?',
            tipo: 'select',
            obrigatorio: true,
            largura: 'inteira',
            opcoes: supervisores.todasOpcoes,
            visivel: (v) => v.perfil === 'SUPERVISOR',
          },
          {
            nome: 'senha',
            label: 'Senha',
            tipo: 'senha',
            obrigatorio: true,
            largura: 'metade',
            visivel: (_v, ed) => !ed,
          },
          {
            nome: 'confirmarSenha',
            label: 'Confirmar senha',
            tipo: 'senha',
            obrigatorio: true,
            largura: 'metade',
            visivel: (_v, ed) => !ed,
          },
          { nome: 'ativo', label: 'Ativo', tipo: 'ativo' },
        ]}
        schemaCriar={schemaCriar}
        schemaEditar={usuarioAtualizarSchema}
        valoresIniciais={{ ativo: true, perfil: 'VENDEDOR' }}
        paraFormulario={(u) => ({
          ...u,
          vendedorId: u.vendedorId ?? '',
          supervisorId: u.supervisorId ?? '',
        })}
        acoesExtras={(u) => (
          <>
            <Button
              variante="fantasma"
              tamanho="icone"
              title="Celulares usados"
              onClick={() => setDispositivosDe(u)}
            >
              <Smartphone className="h-4 w-4" />
            </Button>
            <Button
              variante="fantasma"
              tamanho="icone"
              title="Redefinir senha"
              onClick={() => setSenhaDe(u)}
            >
              <KeyRound className="h-4 w-4" />
            </Button>
          </>
        )}
      />
      {senhaDe && <DialogSenha usuario={senhaDe} aoFechar={() => setSenhaDe(null)} />}
      {dispositivosDe && (
        <DialogDispositivos usuario={dispositivosDe} aoFechar={() => setDispositivosDe(null)} />
      )}
    </>
  );
}

function DialogSenha({ usuario, aoFechar }: { usuario: Usuario; aoFechar: () => void }) {
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);
  const m = useMutation({
    mutationFn: () => http.patch(`/usuarios/${usuario.id}/senha`, { senha }),
    onSuccess: () => setOk(true),
    onError: (e) => setErro(e.message),
  });
  const salvar = () => {
    setErro('');
    const r = usuarioSenhaSchema.safeParse({ senha });
    if (!r.success) return setErro(r.error.issues[0].message);
    if (senha !== confirmar) return setErro('As senhas não conferem');
    m.mutate();
  };
  return (
    <Dialog
      aberto
      aoFechar={aoFechar}
      titulo={`Redefinir senha — ${usuario.login}`}
      rodape={
        ok ? (
          <Button onClick={aoFechar}>Fechar</Button>
        ) : (
          <>
            <Button variante="secundario" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button onClick={salvar} carregando={m.isPending}>
              Redefinir
            </Button>
          </>
        )
      }
    >
      {ok ? (
        <p className="text-sm text-emerald-700">
          Senha redefinida. As sessões abertas deste usuário foram encerradas.
        </p>
      ) : (
        <div className="space-y-3">
          <Campo label="Nova senha">
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoFocus
            />
          </Campo>
          <Campo label="Confirmar nova senha">
            <Input
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
            />
          </Campo>
          <Alerta>{erro}</Alerta>
        </div>
      )}
    </Dialog>
  );
}

function DialogDispositivos({ usuario, aoFechar }: { usuario: Usuario; aoFechar: () => void }) {
  const q = useQuery({
    queryKey: ['/usuarios', usuario.id],
    queryFn: () => http.get<Usuario>(`/usuarios/${usuario.id}`),
  });
  const lista = q.data?.dispositivos ?? [];
  return (
    <Dialog aberto aoFechar={aoFechar} titulo={`Celulares de ${usuario.nome}`} largura="max-w-3xl">
      <Tabela>
        <thead>
          <tr>
            <Th>Modelo</Th>
            <Th>Sistema</Th>
            <Th>Versão app</Th>
            <Th>Último sync</Th>
            <Th>Primeiro acesso</Th>
          </tr>
        </thead>
        <tbody>
          {lista.length === 0 ? (
            <LinhaVazia colunas={5} carregando={q.isLoading} mensagem="Nenhum celular registrado" />
          ) : (
            lista.map((d) => (
              <tr key={d.id}>
                <Td>
                  <div className="font-medium">{d.modelo ?? '-'}</div>
                  <div className="font-mono text-xs text-slate-400">{d.deviceId}</div>
                </Td>
                <Td>{d.sistema ?? '-'}</Td>
                <Td>{d.appVersao ?? '-'}</Td>
                <Td>{formatarDataHora(d.ultimoSync)}</Td>
                <Td>{formatarDataHora(d.createdAt)}</Td>
              </tr>
            ))
          )}
        </tbody>
      </Tabela>
    </Dialog>
  );
}
