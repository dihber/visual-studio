import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatarMoeda, formatarQuantidade } from '@dihber/shared';
import { useRascunho } from '../../../../src/contexto/Rascunho';
import { Botao, Campo, Vazio } from '../../../../src/components/ui';
import { Stepper } from '../../../../src/components/Quantidade';
import { formatarNumeroEntrada, lerNumero } from '../../../../src/lib/texto';
import { cores } from '../../../../src/lib/tema';

export default function Revisao() {
  const r = useRascunho();
  const [salvando, setSalvando] = useState(false);

  const salvar = (sincronizarAgora: boolean) => {
    setSalvando(true);
    try {
      r.salvar();
      r.novo();
      router.dismissAll();
      if (sincronizarAgora) router.push('/sincronizar');
    } catch (e) {
      Alert.alert('Não foi possível salvar', (e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
      <FlatList
        data={r.calculo.itens}
        keyExtractor={(i) => `${i.produto.id}-${i.tipoEmbalagem}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 12, gap: 10 }}
        ListHeaderComponent={
          <Text style={st.cliente}>
            Cliente:{' '}
            <Text style={{ fontWeight: '800' }}>
              {r.cliente?.nomeFantasia || r.cliente?.razaoSocial}
            </Text>
          </Text>
        }
        ListEmptyComponent={<Vazio texto="Nenhum item no pedido." />}
        renderItem={({ item: i, index }) => (
          <View style={st.item}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={st.codigo}>{i.produto.codigo}</Text>
                <Text style={st.descricao}>{i.produto.descricao}</Text>
              </View>
              <Pressable
                onPress={() =>
                  Alert.alert('Remover item', `Remover ${i.produto.descricao}?`, [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Remover', style: 'destructive', onPress: () => r.remover(index) },
                  ])
                }
                hitSlop={10}
              >
                <Text style={st.remover}>🗑</Text>
              </Pressable>
            </View>
            <View style={st.linha}>
              <Text style={st.tipo}>{i.tipoEmbalagem}</Text>
              <Stepper
                texto={formatarNumeroEntrada(i.quantidade)}
                aoMudar={(t) => {
                  const n = lerNumero(t);
                  if (n > 0) r.alterarQuantidade(index, n);
                }}
              />
              <Text style={st.valor}>{formatarMoeda(i.valorTotal)}</Text>
            </View>
            <Text style={st.info}>
              {formatarQuantidade(i.qtdUnidades)} UN × {formatarMoeda(i.produto.precoUnitario)}
            </Text>
          </View>
        )}
        ListFooterComponent={
          <View style={{ gap: 12, marginTop: 6 }}>
            <Pressable onPress={() => router.back()}>
              <Text style={st.maisProdutos}>➕ Adicionar mais produtos</Text>
            </Pressable>
            <Campo
              rotulo="Observação"
              value={r.observacao}
              onChangeText={r.setObservacao}
              multiline
              maxLength={1000}
              placeholder="Ex.: entregar pela manhã"
              style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }}
            />
          </View>
        }
      />
      <View style={st.rodape}>
        <View style={st.totalLinha}>
          <Text style={st.totalRotulo}>Total ({r.itens.length} itens)</Text>
          <Text style={st.total}>{formatarMoeda(r.calculo.total)}</Text>
        </View>
        <Botao
          titulo="SALVAR PEDIDO"
          grande
          variante="sucesso"
          onPress={() => salvar(false)}
          carregando={salvando}
          desabilitado={!r.itens.length}
        />
        <Botao
          titulo="Salvar e sincronizar agora"
          variante="secundario"
          onPress={() => salvar(true)}
          desabilitado={!r.itens.length || salvando}
        />
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  cliente: { fontSize: 15, color: cores.texto, marginBottom: 4 },
  item: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: cores.borda,
    gap: 6,
  },
  codigo: { fontSize: 13, color: cores.textoFraco },
  descricao: { fontSize: 16, fontWeight: '800', color: cores.texto },
  remover: { fontSize: 22 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tipo: { fontSize: 16, fontWeight: '800', color: cores.primaria, width: 36 },
  valor: { fontSize: 16, fontWeight: '800', color: cores.texto, minWidth: 90, textAlign: 'right' },
  info: { fontSize: 13, color: cores.textoSecundario },
  maisProdutos: {
    color: cores.primaria,
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
    padding: 8,
  },
  rodape: {
    padding: 14,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: cores.borda,
  },
  totalLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalRotulo: { fontSize: 15, color: cores.textoSecundario },
  total: { fontSize: 22, fontWeight: '800', color: cores.texto },
});
