import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { formatarDataHora, formatarMoeda } from '@dihber/shared';
import { useAuth } from '../../src/contexto/Auth';
import { useRascunho } from '../../src/contexto/Rascunho';
import { lerMeta } from '../../src/db';
import { contarNaoEnviados, listarPedidos, type PedidoLocal } from '../../src/db/repositorio';
import { Botao, SeloStatus, Vazio } from '../../src/components/ui';
import { cores } from '../../src/lib/tema';

function textoUltimoSync(iso: string | null) {
  if (!iso) return 'nunca';
  const d = new Date(iso);
  const hoje = new Date().toDateString() === d.toDateString();
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return hoje ? `hoje ${hora}` : formatarDataHora(d);
}

export default function Home() {
  const { usuario, sair } = useAuth();
  const rascunho = useRascunho();
  const [pedidos, setPedidos] = useState<PedidoLocal[]>([]);
  const [naoEnviados, setNaoEnviados] = useState(0);
  const [ultimoSync, setUltimoSync] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setPedidos(listarPedidos());
      setNaoEnviados(contarNaoEnviados());
      setUltimoSync(lerMeta('ultimoSync'));
    }, []),
  );

  const confirmarSaida = () => {
    const aviso = naoEnviados
      ? `Você tem ${naoEnviados} pedido(s) não enviado(s). Eles continuam salvos neste celular e serão enviados quando você entrar novamente.`
      : 'Deseja sair do aplicativo?';
    Alert.alert('Sair', aviso, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => sair().then(() => router.replace('/login')),
      },
    ]);
  };

  const cabecalho = (
    <View style={{ gap: 14, paddingBottom: 8 }}>
      <View>
        <Text style={st.ola}>
          Olá, {usuario?.nome.split(' ')[0]}{' '}
          <Text style={st.vend}>(Vendedor {usuario?.vendedor?.codigo})</Text>
        </Text>
        <Text style={st.sync}>Último sync: {textoUltimoSync(ultimoSync)}</Text>
      </View>
      <Botao
        titulo="SINCRONIZAR"
        icone="🔄"
        grande
        onPress={() => router.push('/sincronizar')}
        contador={naoEnviados}
      />
      <Botao
        titulo="NOVO PEDIDO"
        icone="➕"
        grande
        variante="sucesso"
        onPress={() => {
          rascunho.novo();
          router.push('/pedido/novo/cliente');
        }}
      />
      <Text style={st.secao}>Meus pedidos</Text>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={confirmarSaida} hitSlop={12}>
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Sair</Text>
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={pedidos}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={
          <Vazio texto="Nenhum pedido ainda. Toque em NOVO PEDIDO para começar." />
        }
        renderItem={({ item: p }) => (
          <Pressable
            style={({ pressed }) => [st.pedido, pressed && { opacity: 0.7 }]}
            onPress={() => router.push(`/pedido/${p.id}`)}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={st.numero}>
                {p.numero ? `#${p.numero}` : '(novo)'}{' '}
                <Text style={st.cliente}>{p.clienteNome}</Text>
              </Text>
              <Text style={st.data}>{formatarDataHora(p.criadoNoAppEm)}</Text>
              {!!p.erroEnvio && <Text style={st.erro}>⚠ {p.erroEnvio}</Text>}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <SeloStatus pedido={p} />
              <Text style={st.total}>{formatarMoeda(p.valorTotal)}</Text>
            </View>
          </Pressable>
        )}
      />
    </>
  );
}

const st = StyleSheet.create({
  ola: { fontSize: 22, fontWeight: '800', color: cores.texto },
  vend: { fontSize: 16, fontWeight: '500', color: cores.textoSecundario },
  sync: { color: cores.textoSecundario, marginTop: 2, fontSize: 15 },
  secao: { fontSize: 17, fontWeight: '700', color: cores.texto, marginTop: 8 },
  pedido: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  numero: { fontSize: 16, fontWeight: '800', color: cores.texto },
  cliente: { fontWeight: '600' },
  data: { color: cores.textoFraco, fontSize: 13 },
  total: { fontSize: 16, fontWeight: '800', color: cores.texto },
  erro: { color: cores.perigo, fontSize: 13 },
});
