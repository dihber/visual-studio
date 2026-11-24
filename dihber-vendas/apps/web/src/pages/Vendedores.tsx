import { vendedorSchema } from '@dihber/shared';
import type { Vendedor } from '@/api/tipos';
import { PaginaCadastro } from '@/components/PaginaCadastro';
import { Badge } from '@/components/ui/badge';
import { useOpcoes } from '@/hooks/useOpcoes';

export function Vendedores() {
  const supervisores = useOpcoes('/supervisores');
  return (
    <PaginaCadastro<Vendedor>
      titulo="Vendedores"
      endpoint="/vendedores"
      nomeItem="vendedor"
      colunas={[
        { titulo: 'Código', render: (v) => <span className="font-mono">{v.codigo}</span> },
        { titulo: 'Nome', render: (v) => <span className="font-medium">{v.nome}</span> },
        { titulo: 'Supervisor', render: (v) => v.supervisor?.nome ?? <span className="text-slate-400">Sem equipe</span> },
        { titulo: 'Contato', render: (v) => [v.telefone, v.email].filter(Boolean).join(' · ') || '-' },
        { titulo: 'Usuário', render: (v) => (v.usuario ? <Badge cor="azul">{v.usuario.login}</Badge> : <span className="text-slate-400">-</span>) },
      ]}
      campos={[
        { nome: 'codigo', label: 'Código', obrigatorio: true, largura: 'terco', maxLength: 30 },
        { nome: 'nome', label: 'Nome', obrigatorio: true, largura: 'inteira' },
        { nome: 'email', label: 'E-mail', tipo: 'email', largura: 'metade' },
        { nome: 'telefone', label: 'Telefone', largura: 'metade' },
        { nome: 'supervisorId', label: 'Supervisor (equipe)', tipo: 'select', opcoes: supervisores.todasOpcoes, largura: 'inteira' },
        { nome: 'ativo', label: 'Ativo', tipo: 'ativo' },
      ]}
      schemaCriar={vendedorSchema}
      valoresIniciais={{ ativo: true }}
      paraFormulario={(v) => ({ ...v, supervisorId: v.supervisorId ?? '' })}
    />
  );
}
