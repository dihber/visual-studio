import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ErroSessaoExpirada } from '../../src/api/cliente';
import { sincronizar, type Etapa, type ResultadoSync } from '../../src/sync/sincronizar';
import { Botao, Cartao } from '../../src/components/ui';
import { cores } from '../../src/lib/tema';

const ICONE = { aguardando: '◻️', executando: '', ok: '✓', erro: '✕' } as const;

export default function Sincronizar() {
  const { carga } = useLocalSearchParams<{ carga?: string }>();
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState<{ msg: string; sessao: boolean } | null>(null);
  const [resultado, setResultado] = useState<ResultadoSync | null>(null);
  const iniciou = useRef(false);

  const executar = useCallback(async () => {
    setErro(null);
    setResultado(null);
    setRodando(true);
    try {
      setResultado(await sincronizar(setEtapas));
    } catch (e) {
      setErro({ msg: (e as Error).message, sessao: e instanceof ErroSessaoExpirada });
    } finally {
      setRodando(false);
    }
  }, []);

  useEffect(() => {
    if (iniciou.current) return;
    iniciou.current = true;
    executar();
  }, [executar]);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      {carga && (
        <Text style={st.carga}>
          Primeiro acesso: baixando clientes e produtos para usar sem internet.
        </Text>
      )}
      <Cartao estilo={{ gap: 14 }}>
        {etapas.map((e) => (
          <View key={e.chave} style={st.linha}>
            <View style={st.icone}>
              {e.estado === 'executando' ? (
                <ActivityIndicator color={cores.primaria} />
              ) : (
                <Text
                  style={[
                    st.iconeTexto,
                    e.estado === 'ok' && { color: cores.sucesso },
                    e.estado === 'erro' && { color: cores.perigo },
                  ]}
                >
                  {ICONE[e.estado]}
                </Text>
              )}
            </View>
            <Text style={[st.texto, e.estado === 'aguardando' && { color: cores.textoFraco }]}>
              {e.texto}
            </Text>
          </View>
        ))}
        {etapas.length === 0 && <ActivityIndicator color={cores.primaria} />}
      </Cartao>

      {resultado && resultado.rejeitados.length > 0 && (
        <Cartao estilo={{ borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', gap: 6 }}>
          <Text style={{ fontWeight: '700', color: cores.perigo }}>
            Pedidos recusados pelo servidor
          </Text>
          {resultado.rejeitados.map((r, i) => (
            <Text key={i} style={{ color: '#7F1D1D' }}>
              • {r.erro}
            </Text>
          ))}
          <Text style={{ color: cores.textoSecundario, fontSize: 13 }}>
            Abra o pedido, corrija e sincronize novamente.
          </Text>
        </Cartao>
      )}

      {resultado && <Text style={st.sucesso}>Sincronização concluída ✓</Text>}

      {erro && (
        <Cartao estilo={{ borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', gap: 6 }}>
          <Text style={{ fontWeight: '700', color: cores.perigo }}>
            Não foi possível sincronizar
          </Text>
          <Text style={{ color: '#7F1D1D' }}>{erro.msg}</Text>
          <Text style={{ color: cores.textoSecundario, fontSize: 13 }}>
            Nada foi perdido: seus pedidos continuam salvos no celular.
          </Text>
        </Cartao>
      )}

      {!rodando && erro?.sessao && (
        <Botao
          titulo="ENTRAR NOVAMENTE"
          onPress={() => router.push('/login?reautenticar=1')}
          grande
        />
      )}
      {!rodando && erro && (
        <Botao
          titulo="TENTAR NOVAMENTE"
          onPress={executar}
          grande
          variante={erro.sessao ? 'secundario' : 'primario'}
        />
      )}
      {!rodando && (
        <Botao
          titulo={resultado ? 'CONCLUIR' : 'VOLTAR'}
          variante={resultado ? 'sucesso' : 'secundario'}
          grande
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icone: { width: 28, alignItems: 'center' },
  iconeTexto: { fontSize: 20, fontWeight: '800', color: cores.textoFraco },
  texto: { fontSize: 17, color: cores.texto, flex: 1 },
  sucesso: { textAlign: 'center', fontSize: 18, fontWeight: '700', color: cores.sucesso },
  carga: { fontSize: 15, color: cores.textoSecundario, textAlign: 'center' },
});
