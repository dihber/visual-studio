import Constants from 'expo-constants';

/** URL da API: EXPO_PUBLIC_API_URL (build/.env) ou "extra.apiUrl" do app.json. */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  'http://localhost:3333/api/v1';

export const APP_VERSAO = Constants.expoConfig?.version ?? '1.0.0';
