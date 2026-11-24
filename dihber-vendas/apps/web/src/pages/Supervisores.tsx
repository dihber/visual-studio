import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supervisorSchema } from '@dihber/shared';
import { http } from '@/api/cliente';
import type { Supervisor } from '@/api/tipos';
import { PaginaCadastro } from '@/components/PaginaCadastro';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { BadgeAtivo } from '@/components/ui/badge';

export function Supervisores() {
  const [equipeDe, setEquipeDe] = useState<Supervisor | null>(null);
  return (
    <>
      <PaginaCadastro<Supervisor>
        titulo="Supervisores"
        endpoint="/supervisores"
        nomeItem="supervisor"
        colunas={[
          { titulo: 'Código', render: (s) => <span className="font-mono">{s.codigo}</span> },
          { titulo: 'Nome', render: (s) => <span className="font-medium">{s.nome}</span> },
          { titulo: 'Contato', render: (s) => [s.telefone, s.email].filter(Boolean).join(' · ') || '-' },
          { titulo: 'Vendedores', render: (s) => s._count?.vendedores ?? 0, className: 'text-right' },
        ]}
        campos={[
          { nome: 'codigo', label: 'Código', obrigatorio: true, largura: 'terco', maxLength: 30 },
          { nome: 'nome', label: 'Nome', obrigatorio: true, largura: 'inteira' },
          { nome: 'email', label: 'E-mail', tipo: 'email', largura: 'metade' },
          { nome: 'telefone', label: 'Telefone', largura: 'metade' },
          { nome: 'ativo', label: 'Ativo', tipo: 'ativo' },
        ]}
        schemaCriar={supervisorSchema}
        valoresIniciais={{ ativo: true }}
        paraFormulario={(s) => ({ ...s })}
        acoesExtras={(s) => (
          <Button variante="fantasma" tamanho="icone" title="Ver equipe" onClick={() => setEquipeDe(s)}>
            <Users className="h-4 w-4" />
          </Button>
        )}
      />
      {equipeDe && <DialogEquipe supervisor={equipeDe} aoFechar={() => setEquipeDe(null)} />}
    </>
  );
}

function DialogEquipe({ supervisor, aoFechar }: { supervisor: Supervisor; aoFechar: () => void }) {
  const q = useQuery({
    queryKey: ['/supervisores', supervisor.id],
    queryFn: () => http.get<Supervisor>(`/supervisores/${supervisor.id}`),
  });
  const vendedores = q.data?.vendedores ?? [];
  return (
    <Dialog aberto aoFechar={aoFechar} titulo={`Equipe de ${supervisor.nome}`}>
      {q.isLoading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : vendedores.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum vendedor nesta equipe.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {vendedores.map((v) => (
            <li key={v.id} className="flex items-center justify-between py-2 text-sm">
              <Link to={`/pedidos?vendedorId=${v.id}`} className="text-primary hover:underline">
                {v.codigo} - {v.nome}
              </Link>
              <BadgeAtivo ativo={v.ativo} />
            </li>
          ))}
        </ul>
      )}
      {q.data?.usuario && <p className="mt-3 text-xs text-slate-500">Usuário de acesso: {q.data.usuario.login}</p>}
    </Dialog>
  );
}
