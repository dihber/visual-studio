import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { carregarSessao, type UsuarioApp } from '../api/sessao';
import { entrar as entrarApi, sair as sairApi } from '../sync/auth';

interface AuthCtx {
  carregando: boolean;
  usuario: UsuarioApp | null;
  entrar: (login: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [usuario, setUsuario] = useState<UsuarioApp | null>(null);

  useEffect(() => {
    carregarSessao()
      .then((s) => setUsuario(s?.usuario ?? null))
      .finally(() => setCarregando(false));
  }, []);

  return (
    <Ctx.Provider
      value={{
        carregando,
        usuario,
        entrar: async (l, s) => setUsuario((await entrarApi(l, s)).usuario),
        sair: async () => {
          await sairApi();
          setUsuario(null);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fora do AuthProvider');
  return c;
}
