import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../src/contexto/Auth';
import { cores } from '../../src/lib/tema';

export default function AppLayout() {
  const { carregando, usuario } = useAuth();
  if (carregando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={cores.primaria} />
      </View>
    );
  }
  if (!usuario) return <Redirect href="/login" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: cores.primaria },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: cores.fundo },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'DihberVendas' }} />
      <Stack.Screen name="sincronizar" options={{ title: 'Sincronizar', presentation: 'modal' }} />
      <Stack.Screen name="pedido/novo/cliente" options={{ title: 'Novo pedido · Cliente' }} />
      <Stack.Screen name="pedido/novo/produtos" options={{ title: 'Novo pedido · Produtos' }} />
      <Stack.Screen name="pedido/novo/revisao" options={{ title: 'Revisar pedido' }} />
      <Stack.Screen name="pedido/[id]" options={{ title: 'Pedido' }} />
    </Stack>
  );
}
