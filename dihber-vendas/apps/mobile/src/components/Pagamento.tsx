import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cores } from '../lib/tema';
import { opcoesPagamento, type PagamentoEscolhido } from '../lib/rascunho';

/** Escolha da forma de pagamento: PIX sempre; boleto só nos prazos do cliente. */
export function SeletorPagamento({
  prazos,
  valor,
  aoMudar,
}: {
  prazos: { id: string; descricao: string }[];
  valor: PagamentoEscolhido | null;
  aoMudar: (p: PagamentoEscolhido) => void;
}) {
  const opcoes = opcoesPagamento(prazos);
  const selecionada = valor ? (valor.forma === 'PIX' ? 'PIX' : valor.prazoId) : null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={st.rotulo}>
        Forma de pagamento <Text style={{ color: cores.perigo }}>*</Text>
      </Text>
      {opcoes.map((o) => {
        const ativa = selecionada === o.chave;
        return (
          <Pressable
            key={o.chave}
            onPress={() => aoMudar(o)}
            style={[st.opcao, ativa && st.opcaoAtiva]}
            accessibilityRole="radio"
            accessibilityState={{ checked: ativa }}
          >
            <View style={[st.radio, ativa && st.radioAtivo]}>
              {ativa && <View style={st.radioPonto} />}
            </View>
            <Text style={[st.texto, ativa && { color: cores.primaria }]}>
              {o.forma === 'PIX' ? '⚡ ' : '🧾 '}
              {o.texto}
            </Text>
          </Pressable>
        );
      })}
      {prazos.length === 0 && (
        <Text style={st.aviso}>Este cliente não tem prazo de boleto cadastrado: só PIX.</Text>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  rotulo: { fontSize: 14, fontWeight: '600', color: cores.textoSecundario },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: cores.borda,
    backgroundColor: '#FFFFFF',
  },
  opcaoAtiva: { borderColor: cores.primaria, backgroundColor: '#EFF6FF' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: cores.textoFraco,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioAtivo: { borderColor: cores.primaria },
  radioPonto: { width: 11, height: 11, borderRadius: 6, backgroundColor: cores.primaria },
  texto: { fontSize: 16, fontWeight: '600', color: cores.texto },
  aviso: { fontSize: 13, color: cores.textoSecundario },
});
