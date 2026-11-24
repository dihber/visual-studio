import { NavLink, Navigate, Outlet } from 'react-router-dom';
import {
  BarChart3,
  Boxes,
  ClipboardList,
  LogOut,
  Menu,
  Store,
  UserCog,
  Users,
  UsersRound,
} from 'lucide-react';
import { useState } from 'react';
import { PERFIL_LABEL } from '@dihber/shared';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const MENU = [
  { para: '/pedidos', label: 'Pedidos', icone: ClipboardList, perfis: ['ADMIN', 'SUPERVISOR'] },
  {
    para: '/vendas-equipe',
    label: 'Vendas da equipe',
    icone: BarChart3,
    perfis: ['ADMIN', 'SUPERVISOR'],
  },
  { para: '/clientes', label: 'Clientes', icone: Store, perfis: ['ADMIN', 'SUPERVISOR'] },
  { para: '/produtos', label: 'Produtos', icone: Boxes, perfis: ['ADMIN', 'SUPERVISOR'] },
  { para: '/vendedores', label: 'Vendedores', icone: Users, perfis: ['ADMIN'] },
  { para: '/supervisores', label: 'Supervisores', icone: UsersRound, perfis: ['ADMIN'] },
  { para: '/usuarios', label: 'Usuários', icone: UserCog, perfis: ['ADMIN'] },
];

export function AppLayout() {
  const { usuario, sair } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false);
  if (!usuario) return <Navigate to="/login" replace />;

  const itens = MENU.filter((m) => m.perfis.includes(usuario.perfil));

  return (
    <div className="flex min-h-full">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0',
          menuAberto ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
            DV
          </div>
          <span className="text-lg font-semibold">DihberVendas</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {itens.map((m) => (
            <NavLink
              key={m.para}
              to={m.para}
              onClick={() => setMenuAberto(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                  isActive ? 'bg-blue-50 text-primary' : 'text-slate-600 hover:bg-slate-100',
                )
              }
            >
              <m.icone className="h-4 w-4" />
              {m.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <div className="px-3 pb-2">
            <p className="truncate text-sm font-medium">{usuario.nome}</p>
            <p className="text-xs text-slate-500">
              {PERFIL_LABEL[usuario.perfil]}
              {usuario.supervisor && ` · ${usuario.supervisor.nome}`}
            </p>
          </div>
          <button
            onClick={sair}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>
      {menuAberto && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
          onClick={() => setMenuAberto(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-slate-200 bg-white px-4 lg:hidden">
          <button
            onClick={() => setMenuAberto(true)}
            className="rounded p-2 hover:bg-slate-100"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="ml-2 font-semibold">DihberVendas</span>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function SomenteAdmin({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  if (usuario?.perfil !== 'ADMIN') return <Navigate to="/pedidos" replace />;
  return <>{children}</>;
}
