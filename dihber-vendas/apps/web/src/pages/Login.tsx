import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Campo, Input } from '@/components/ui/input';
import { Alerta } from '@/components/ui/alerta';

export function Login() {
  const { usuario, entrar } = useAuth();
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  if (usuario) return <Navigate to="/pedidos" replace />;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await entrar(login.trim(), senha);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <form onSubmit={enviar} className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-white">DV</div>
          <h1 className="text-2xl font-semibold">DihberVendas</h1>
          <p className="text-sm text-slate-500">Portal de pedidos de venda</p>
        </div>
        <div className="space-y-4">
          <Campo label="Usuário">
            <Input autoFocus autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required />
          </Campo>
          <Campo label="Senha">
            <Input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
          </Campo>
          <Alerta>{erro}</Alerta>
          <Button type="submit" className="w-full" carregando={carregando}>
            Entrar
          </Button>
        </div>
      </form>
    </div>
  );
}
