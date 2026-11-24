import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/contexto/Auth';
import { Botao, Campo } from '../src/components/ui';
import { cores } from '../src/lib/tema';
import { lerMeta } from '../src/db';

export default function Login() {
  const { usuario, entrar } = useAuth();
  const { reautenticar } = useLocalSearchParams<{ reautenticar?: string }>();
  const [login, setLogin] = useState(usuario?.login ?? '');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  if (usuario && !reautenticar) return <Redirect href="/" />;

  const enviar = async () => {
    if (!login.trim() || !senha) return setErro('Informe usuário e senha.');
    setErro('');
    setCarregando(true);
    try {
      await entrar(login.trim(), senha);
      // primeiro acesso: faz a carga inicial; reautenticação: volta e sincroniza
      if (reautenticar && router.canGoBack()) router.back();
      else router.replace(lerMeta('desde') ? '/' : '/sincronizar?carga=1');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: cores.primaria }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={st.container}
      >
        <View style={st.topo}>
          <View style={st.logo}>
            <Text style={st.logoTexto}>DV</Text>
          </View>
          <Text style={st.titulo}>DihberVendas</Text>
          {reautenticar && (
            <Text style={st.sub}>Sua sessão expirou. Entre novamente para sincronizar.</Text>
          )}
        </View>
        <View style={st.form}>
          <Campo
            rotulo="Usuário"
            value={login}
            onChangeText={setLogin}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          <Campo
            rotulo="Senha"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={enviar}
          />
          {!!erro && <Text style={st.erro}>{erro}</Text>}
          <Botao titulo="ENTRAR" onPress={enviar} carregando={carregando} grande />
          {!reautenticar && (
            <Text style={st.dica}>
              O primeiro acesso precisa de internet para baixar clientes e produtos.
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  topo: { alignItems: 'center', marginBottom: 28 },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoTexto: { fontSize: 28, fontWeight: '800', color: cores.primaria },
  titulo: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  sub: { color: '#DBEAFE', marginTop: 8, textAlign: 'center' },
  form: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, gap: 16 },
  erro: { color: cores.perigo, fontSize: 15 },
  dica: { color: cores.textoFraco, fontSize: 13, textAlign: 'center' },
});
