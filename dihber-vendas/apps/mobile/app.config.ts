import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Variante de TESTE (APP_VARIANT=teste, perfil "teste" do eas.json):
 * - permite HTTP sem criptografia, para falar com a API rodando no computador da rede local;
 * - usa outro nome e outro pacote, para poder ser instalada junto com o app oficial.
 * Builds de produção continuam aceitando apenas HTTPS.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const teste = process.env.APP_VARIANT === 'teste';
  return {
    ...config,
    name: teste ? 'DihberVendas (teste)' : (config.name ?? 'DihberVendas'),
    slug: config.slug ?? 'dihber-vendas',
    android: {
      ...config.android,
      package: teste ? 'br.com.dihber.vendas.teste' : config.android?.package,
    },
    plugins: [
      ...(config.plugins ?? []),
      ['expo-build-properties', { android: { usesCleartextTraffic: teste } }],
    ],
  };
};
