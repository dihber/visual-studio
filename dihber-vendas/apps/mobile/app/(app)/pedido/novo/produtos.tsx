import { memo, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  formatarMoeda,
  formatarQuantidade,
  textoConversao,
  type TipoEmbalagem,
} from '@dihber/shared';
import { useRascunho } from '../../../../src/contexto/Rascunho';
import {
  buscarProdutos,
  contarProdutos,
  saldoParaPedido,
  type ProdutoLocal,
} from '../../../../src/db/repositorio';
import { Botao, Campo, Vazio } from '../../../../src/components/ui';
import { SeletorEmbalagem, Stepper } from '../../../../src/components/Quantidade';
import { quantidadeNoPedido, unidadesNoRascunho } from '../../../../src/lib/rascunho';
import { lerNumero } from '../../../../src/lib/texto';
import { cores } from '../../../../src/lib/tema';

export default function SelecionarProdutos() {
  const r = useRascunho();
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState<ProdutoLocal[]>([]);
  const [total] = useState(() => contarProdutos());

  useEffect(() => {
    setLista(buscarProdutos(busca, r.cliente?.tabelaPrecoId ?? null));
  }, [busca, r.cliente?.tabelaPrecoId]);

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
      <View style={st.topo}>
        <View style={st.clienteLinha}>
          <Text style={st.cliente} numberOfLines={1}>
            Cliente:{' '}
            <Text style={{ fontWeight: '800' }}>
              {r.cliente?.nomeFantasia || r.cliente?.razaoSocial}
            </Text>
          </Text>
          <Pressable
            onPress={() => router.push('/pedido/novo/cliente')}
            hitSlop={10}
            accessibilityLabel="Trocar cliente"
          >
            <Text style={st.editar}>✎</Text>
          </Pressable>
        </View>
        <Campo
          placeholder="🔍 Buscar produto..."
          value={busca}
          onChangeText={setBusca}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={lista}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 12, gap: 10 }}
        initialNumToRender={8}
        windowSize={7}
        ListEmptyComponent={
          <Vazio
            texto={
              total === 0
                ? 'Nenhum produto no celular. Sincronize para baixar os produtos.'
                : 'Nenhum produto encontrado.'
            }
          />
        }
        renderItem={({ item }) => (
          <CartaoProduto
            produto={item}
            noPedidoCx={quantidadeNoPedido(r.itens, item.id, 'CX')}
            noPedidoUn={quantidadeNoPedido(r.itens, item.id, 'UN')}
            saldo={(() => {
              const s = saldoParaPedido(item.id, r.id);
              return s === null ? null : s - unidadesNoRascunho(r.itens, item.id);
            })()}
            aoAdicionar={(tipo, qtd) => {
              try {
                r.adicionar(item, tipo, qtd);
                return true;
              } catch (e) {
                Alert.alert('Sem saldo', (e as Error).message);
                return false;
              }
            }}
          />
        )}
      />

      <View style={st.rodape}>
        <View style={{ flex: 1 }}>
          <Text style={st.rodapeTexto}>Itens no pedido: {r.itens.length}</Text>
          <Text style={st.rodapeTotal}>Total: {formatarMoeda(r.calculo.total)}</Text>
        </View>
        <Botao
          titulo="REVISAR ▶"
          onPress={() => router.push('/pedido/novo/revisao')}
          desabilitado={r.itens.length === 0}
        />
      </View>
    </SafeAreaView>
  );
}

const CartaoProduto = memo(function CartaoProduto({
  produto: p,
  noPedidoCx,
  noPedidoUn,
  saldo,
  aoAdicionar,
}: {
  produto: ProdutoLocal;
  noPedidoCx: number;
  noPedidoUn: number;
  /** saldo que ainda dá para pôr neste pedido (UN); null = sem controle de estoque */
  saldo: number | null;
  aoAdicionar: (tipo: TipoEmbalagem, qtd: number) => boolean;
}) {
  const [tipo, setTipo] = useState<TipoEmbalagem>('CX');
  const [qtd, setQtd] = useState('1');
  const n = lerNumero(qtd);
  const valido = n > 0;

  return (
    <View style={st.cartao}>
      <Text style={st.codigo}>{p.codigo}</Text>
      <Text style={st.descricao}>{p.descricao}</Text>
      <Text style={st.info}>
        Emb.: {p.embalagem} · {formatarMoeda(p.precoUnitario)}/UN
        {p.precoUnitario !== p.precoBase ? ' (tabela do cliente)' : ''}
      </Text>
      <View style={st.controles}>
        <SeletorEmbalagem valor={tipo} aoMudar={setTipo} />
        <Stepper texto={qtd} aoMudar={setQtd} />
        <Pressable
          style={[st.adicionar, !valido && { opacity: 0.4 }]}
          disabled={!valido}
          onPress={() => {
            if (aoAdicionar(tipo, n)) setQtd('1');
          }}
          accessibilityLabel="Adicionar ao pedido"
        >
          <Text style={st.adicionarTexto}>+</Text>
        </Pressable>
      </View>
      {saldo !== null && (
        <Text style={[st.saldo, saldo <= 0 && { color: cores.perigo }]}>
          {saldo <= 0 ? 'Sem saldo disponível' : `Disponível: ${formatarQuantidade(saldo)} UN`}
        </Text>
      )}
      <Text style={st.conversao}>
        {valido ? textoConversao(tipo, n, p.qtdPorCaixa) : 'Informe a quantidade'}
      </Text>
      {(noPedidoCx > 0 || noPedidoUn > 0) && (
        <Text style={st.noPedido}>
          ✓ No pedido:{' '}
          {[
            noPedidoCx && `${formatarQuantidade(noPedidoCx)} CX`,
            noPedidoUn && `${formatarQuantidade(noPedidoUn)} UN`,
          ]
            .filter(Boolean)
            .join(' + ')}
        </Text>
      )}
    </View>
  );
});

const st = StyleSheet.create({
  topo: {
    padding: 12,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: cores.borda,
  },
  clienteLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cliente: { fontSize: 15, color: cores.texto, flex: 1 },
  editar: { fontSize: 22, color: cores.primaria, paddingHorizontal: 6 },
  cartao: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: cores.borda,
    gap: 4,
  },
  codigo: { fontSize: 13, color: cores.textoFraco, fontWeight: '600' },
  descricao: { fontSize: 17, fontWeight: '800', color: cores.texto },
  info: { fontSize: 14, color: cores.textoSecundario },
  controles: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  adicionar: {
    width: 52,
    height: 44,
    borderRadius: 10,
    backgroundColor: cores.sucesso,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adicionarTexto: { fontSize: 26, color: '#FFFFFF', fontWeight: '800', marginTop: -2 },
  saldo: { fontSize: 14, fontWeight: '700', color: cores.sucesso, marginTop: 2 },
  conversao: { fontSize: 14, color: cores.primaria, fontWeight: '600', marginTop: 4 },
  noPedido: { fontSize: 14, color: cores.sucesso, fontWeight: '700' },
  rodape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: cores.borda,
  },
  rodapeTexto: { fontSize: 14, color: cores.textoSecundario },
  rodapeTotal: { fontSize: 19, fontWeight: '800', color: cores.texto },
});
