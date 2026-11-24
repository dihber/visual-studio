import { apiPublica } from '../api/cliente';
import { dadosDispositivo, salvarSessao, type SessaoApp } from '../api/sessao';
import { gravarMeta, lerMeta, limparDadosLocais } from '../db';
import { contarNaoEnviados } from '../db/repositorio';

/**
 * Login do vendedor. Se outro usuário entrar no mesmo celular, os dados locais são
 * substituídos — mas nunca com pedidos não enviados do usuário anterior.
 */
export async function entrar(login: string, senha: string): Promise<SessaoApp> {
  const dispositivo = await dadosDispositivo();
  const sessao = await apiPublica<SessaoApp>('/auth/login', {
    login,
    senha,
    origem: 'app',
    dispositivo,
  });
  if (!sessao.usuario.vendedor) {
    throw new Error('Seu usuário não está vinculado a um vendedor. Procure o administrador.');
  }
  const anterior = lerMeta('usuarioId');
  if (anterior && anterior !== sessao.usuario.id) {
    if (contarNaoEnviados() > 0) {
      throw new Error(
        'Há pedidos não enviados de outro vendedor neste celular. Entre com o usuário anterior e sincronize antes de trocar.',
      );
    }
    limparDadosLocais();
  }
  gravarMeta('usuarioId', sessao.usuario.id);
  await salvarSessao(sessao);
  return sessao;
}

export async function sair() {
  await salvarSessao(null);
}
