import { clienteSchema, formatarCpfCnpj } from '@dihber/shared';
import type { Cliente } from '@/api/tipos';
import { PaginaCadastro } from '@/components/PaginaCadastro';
import { useAuth } from '@/hooks/useAuth';

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

export function Clientes() {
  const { ehAdmin } = useAuth();
  return (
    <PaginaCadastro<Cliente>
      titulo="Clientes"
      subtitulo={ehAdmin ? undefined : 'Consulta'}
      endpoint="/clientes"
      nomeItem="cliente"
      placeholderBusca="Buscar por código, nome, CPF/CNPJ ou cidade..."
      colunas={[
        { titulo: 'Código', render: (c) => <span className="font-mono">{c.codigo}</span> },
        {
          titulo: 'Cliente',
          render: (c) => (
            <div>
              <div className="font-medium">{c.razaoSocial}</div>
              {c.nomeFantasia && <div className="text-xs text-slate-500">{c.nomeFantasia}</div>}
            </div>
          ),
        },
        { titulo: 'CPF/CNPJ', render: (c) => <span className="whitespace-nowrap">{formatarCpfCnpj(c.cpfCnpj)}</span> },
        { titulo: 'Cidade/UF', render: (c) => [c.cidade, c.uf].filter(Boolean).join(' / ') || '-' },
        { titulo: 'Telefone', render: (c) => c.telefone ?? '-' },
      ]}
      campos={[
        { nome: 'codigo', label: 'Código', obrigatorio: true, largura: 'terco', maxLength: 30 },
        { nome: 'cpfCnpj', label: 'CPF/CNPJ', obrigatorio: true, largura: 'terco', maxLength: 18 },
        { nome: 'telefone', label: 'Telefone', largura: 'terco' },
        { nome: 'razaoSocial', label: 'Razão social', obrigatorio: true, largura: 'inteira' },
        { nome: 'nomeFantasia', label: 'Nome fantasia', largura: 'metade' },
        { nome: 'email', label: 'E-mail', tipo: 'email', largura: 'metade' },
        { nome: 'endereco', label: 'Endereço', largura: 'inteira' },
        { nome: 'cidade', label: 'Cidade', largura: 'metade' },
        { nome: 'uf', label: 'UF', tipo: 'select', largura: 'metade', opcoes: UFS.map((u) => ({ valor: u, label: u })) },
        { nome: 'ativo', label: 'Ativo', tipo: 'ativo' },
      ]}
      schemaCriar={clienteSchema}
      valoresIniciais={{ ativo: true }}
      paraFormulario={(c) => ({ ...c, cpfCnpj: formatarCpfCnpj(c.cpfCnpj) })}
    />
  );
}
