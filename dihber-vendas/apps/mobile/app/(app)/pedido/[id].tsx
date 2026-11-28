import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  formatarDataHora,
  formatarMoeda,
  formatarQuantidade,
  textoPagamento,
} from '@dihber/shared';
import { useRascunho } from '../../../src/contexto/Rascunho';
import { excluirPedido, obterPedido } from '../../../src/db/repositorio';
import { Botao, Cartao, SeloStatus, Vazio } from '../../../src/components/ui';
import { cores } from '../../../src/lib/tema';

export default function DetalhePedido() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rascunho = useRascunho();
  const [dados, setDados] = useState(() => obterPedido(id));

  useFocusEffect(useCallback(() => setDados(obterPedido(id)), [id]));

  if (!dados) return <Vazio texto="Pedido não encontrado." />;
  const { pedido: p, itens } = dados;
  const naoEnviado = p.situacao === 'NAO_ENVIADO';

  const editar = () => {
    if (rascunho.carregar(p.id)) router.push('/pedido/novo/produtos');
  };
  const excluir = () =>
    Alert.alert('Excluir pedido', 'Este pedido ainda não foi enviado. Deseja excluí-lo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          try {
            excluirPedido(p.id);
            router.back();
          } catch (e) {
            Alert.alert('Erro', (e as Error).message);
          }
        },
      },
    ]);

  return (
    <>
      <Stack.Screen
        options={{ title: p.numero ? `Pedido #${p.numero}` : 'Pedido (não enviado)' }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Cartao estilo={{ gap: 6 }}>
          <SeloStatus pedido={p} />
          <Text style={st.cliente}>{p.clienteNome}</Text>
          <Text style={st.info}>Código do cliente: {p.clienteCodigo}</Text>
          <Text style={st.info}>Feito em: {formatarDataHora(p.criadoNoAppEm)}</Text>
          {p.enviadoEm && <Text style={st.info}>Enviado em: {formatarDataHora(p.enviadoEm)}</Text>}
          <Text style={st.info}>
            Pagamento: {textoPagamento(p.formaPagamento, p.prazoDescricao)}
          </Text>
          {!!p.observacao && <Text style={st.info}>Obs.: {p.observacao}</Text>}
        </Cartao>

        {p.status === 'REPROVADO' && (
          <Cartao estilo={st.alertaErro}>
            <Text style={st.alertaTitulo}>Motivo da reprovação</Text>
            <Text style={st.alertaTexto}>{p.motivoReprovacao}</Text>
          </Cartao>
        )}
        {p.status === 'CANCELADO' && (
          <Cartao estilo={st.alertaCancelado}>
            <Text style={st.alertaTituloCancelado}>Pedido cancelado</Text>
            {!!p.motivoCancelamento && (
              <Text style={st.alertaTextoCancelado}>{p.motivoCancelamento}</Text>
            )}
          </Cartao>
        )}
        {naoEnviado && !!p.erroEnvio && (
          <Cartao estilo={st.alertaErro}>
            <Text style={st.alertaTitulo}>Recusado no último envio</Text>
            <Text style={st.alertaTexto}>{p.erroEnvio}</Text>
            <Text style={st.info}>Edite o pedido para corrigir e sincronize novamente.</Text>
          </Cartao>
        )}

        <Cartao estilo={{ gap: 10 }}>
          <Text style={st.secao}>Itens ({itens.length})</Text>
          {itens.map((i) => (
            <View key={i.id} style={st.item}>
              <View style={{ flex: 1 }}>
                <Text style={st.descricao}>
                  {i.codigo} · {i.descricao}
                </Text>
                <Text style={st.info}>
                  {formatarQuantidade(i.quantidade)} {i.tipoEmbalagem}
                  {i.tipoEmbalagem === 'CX'
                    ? ` = ${formatarQuantidade(i.qtdUnidades)} UN`
                    : ''} × {formatarMoeda(i.precoUnitario)}
                </Text>
              </View>
              <Text style={st.valor}>{formatarMoeda(i.valorTotal)}</Text>
            </View>
          ))}
          <View style={st.totalLinha}>
            <Text style={st.secao}>Total</Text>
            <Text style={st.total}>{formatarMoeda(p.valorTotal)}</Text>
          </View>
          {!naoEnviado && <Text style={st.info}>Valores confirmados pelo servidor.</Text>}
        </Cartao>

        {naoEnviado ? (
          <View style={{ gap: 10 }}>
            <Botao titulo="EDITAR PEDIDO" grande onPress={editar} />
            <Botao titulo="Excluir pedido" variante="perigo" onPress={excluir} />
          </View>
        ) : (
          <Text style={[st.info, { textAlign: 'center' }]}>
            Pedidos enviados não podem ser alterados.
          </Text>
        )}
      </ScrollView>
    </>
  );
}

const st = StyleSheet.create({
  cliente: { fontSize: 19, fontWeight: '800', color: cores.texto },
  info: { fontSize: 14, color: cores.textoSecundario },
  secao: { fontSize: 16, fontWeight: '800', color: cores.texto },
  item: {
    flexDirection: 'row',
    gap: 8,
    borderBottomWidth: 1,
    borderColor: cores.borda,
    paddingBottom: 8,
  },
  descricao: { fontSize: 15, fontWeight: '600', color: cores.texto },
  valor: { fontSize: 15, fontWeight: '700', color: cores.texto },
  totalLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { fontSize: 20, fontWeight: '800', color: cores.texto },
  alertaErro: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', gap: 4 },
  alertaTitulo: { fontWeight: '800', color: cores.perigo },
  alertaTexto: { color: '#7F1D1D', fontSize: 15 },
  alertaCancelado: { borderColor: '#CBD5E1', backgroundColor: '#F1F5F9', gap: 4 },
  alertaTituloCancelado: { fontWeight: '800', color: '#334155' },
  alertaTextoCancelado: { color: '#1E293B', fontSize: 15 },
});
