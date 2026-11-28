import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { formatarCpfCnpj } from '@dihber/shared';
import { useRascunho } from '../../../../src/contexto/Rascunho';
import { buscarClientes, contarClientes, type ClienteLocal } from '../../../../src/db/repositorio';
import { Campo, Vazio } from '../../../../src/components/ui';
import { cores } from '../../../../src/lib/tema';

export default function SelecionarCliente() {
  const rascunho = useRascunho();
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState<ClienteLocal[]>([]);
  const [total] = useState(() => contarClientes());

  useEffect(() => {
    setLista(buscarClientes(busca));
  }, [busca]);

  const selecionar = (c: ClienteLocal) => {
    const trocando = !!rascunho.cliente;
    rascunho.definirCliente(c);
    if (trocando && router.canGoBack()) router.back();
    else router.push('/pedido/novo/produtos');
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={st.busca}>
        <Campo
          placeholder="🔍 Buscar por código, nome ou CNPJ..."
          value={busca}
          onChangeText={setBusca}
          autoFocus
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>
      <FlatList
        data={lista}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 8 }}
        ListEmptyComponent={
          <Vazio
            texto={
              total === 0
                ? 'Nenhum cliente no celular. Sincronize para baixar os clientes.'
                : 'Nenhum cliente encontrado.'
            }
          />
        }
        renderItem={({ item: c }) => (
          <Pressable
            style={({ pressed }) => [st.item, pressed && { backgroundColor: '#EFF6FF' }]}
            onPress={() => selecionar(c)}
          >
            <Text style={st.nome}>{c.nomeFantasia || c.razaoSocial}</Text>
            {!!c.nomeFantasia && <Text style={st.razao}>{c.razaoSocial}</Text>}
            <Text style={st.detalhe}>
              {c.codigo} · {formatarCpfCnpj(c.cpfCnpj)}
              {c.cidade ? ` · ${c.cidade}/${c.uf ?? ''}` : ''}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const st = StyleSheet.create({
  busca: { padding: 16, paddingBottom: 8 },
  item: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: cores.borda,
    gap: 2,
  },
  nome: { fontSize: 17, fontWeight: '700', color: cores.texto },
  razao: { fontSize: 14, color: cores.textoSecundario },
  detalhe: { fontSize: 13, color: cores.textoFraco, marginTop: 2 },
});
