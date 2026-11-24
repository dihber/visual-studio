import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { lerSessao, login as apiLogin, logout as apiLogout, type UsuarioLogado } from '@/api/cliente';

interface AuthCtx {
  usuario: UsuarioLogado | null;
  entrar: (login: string, senha: string) => Promise<void>;
  sair: () => void;
  ehAdmin: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(() => lerSessao()?.usuario ?? null);

  useEffect(() => {
    const atualizar = () => setUsuario(lerSessao()?.usuario ?? null);
    window.addEventListener('dihber:sessao', atualizar);
    window.addEventListener('storage', atualizar);
    return () => {
      window.removeEventListener('dihber:sessao', atualizar);
      window.removeEventListener('storage', atualizar);
    };
  }, []);

  const valor: AuthCtx = {
    usuario,
    entrar: async (l, s) => {
      const sessao = await apiLogin(l, s);
      setUsuario(sessao.usuario);
    },
    sair: () => {
      apiLogout();
      setUsuario(null);
    },
    ehAdmin: usuario?.perfil === 'ADMIN',
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fora do AuthProvider');
  return c;
}
