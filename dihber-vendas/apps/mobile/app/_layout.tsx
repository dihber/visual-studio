import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { migrarBanco } from '../src/db';
import { AuthProvider } from '../src/contexto/Auth';
import { RascunhoProvider } from '../src/contexto/Rascunho';
import { cores } from '../src/lib/tema';

migrarBanco();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RascunhoProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: cores.primaria },
              headerTintColor: '#FFFFFF',
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: cores.fundo },
            }}
          >
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="(app)" options={{ headerShown: false }} />
          </Stack>
        </RascunhoProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
