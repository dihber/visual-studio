import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErroApi } from '@/api/cliente';
import { AuthProvider } from '@/hooks/useAuth';
import { AppLayout, SomenteAdmin } from '@/layouts/AppLayout';
import { Login } from '@/pages/Login';
import { Pedidos } from '@/pages/Pedidos';
import { PedidoDetalhe } from '@/pages/PedidoDetalhe';
import { VendasEquipe } from '@/pages/VendasEquipe';
import { Clientes } from '@/pages/Clientes';
import { Produtos } from '@/pages/Produtos';
import { TabelasPreco } from '@/pages/TabelasPreco';
import { Prazos } from '@/pages/Prazos';
import { Vendedores } from '@/pages/Vendedores';
import { Supervisores } from '@/pages/Supervisores';
import { Usuarios } from '@/pages/Usuarios';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      retry: (n, e) => !(e instanceof ErroApi && e.status >= 400 && e.status < 500) && n < 2,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<AppLayout />}>
              <Route path="/pedidos" element={<Pedidos />} />
              <Route path="/pedidos/:id" element={<PedidoDetalhe />} />
              <Route path="/vendas-equipe" element={<VendasEquipe />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/produtos" element={<Produtos />} />
              <Route
                path="/tabelas-preco"
                element={
                  <SomenteAdmin>
                    <TabelasPreco />
                  </SomenteAdmin>
                }
              />
              <Route
                path="/prazos"
                element={
                  <SomenteAdmin>
                    <Prazos />
                  </SomenteAdmin>
                }
              />
              <Route
                path="/vendedores"
                element={
                  <SomenteAdmin>
                    <Vendedores />
                  </SomenteAdmin>
                }
              />
              <Route
                path="/supervisores"
                element={
                  <SomenteAdmin>
                    <Supervisores />
                  </SomenteAdmin>
                }
              />
              <Route
                path="/usuarios"
                element={
                  <SomenteAdmin>
                    <Usuarios />
                  </SomenteAdmin>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/pedidos" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
