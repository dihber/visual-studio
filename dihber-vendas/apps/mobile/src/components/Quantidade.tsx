import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TipoEmbalagem } from '@dihber/shared';
import { cores } from '../lib/tema';
import { formatarNumeroEntrada, lerNumero } from '../lib/texto';

/** Seletor CX | UN. */
export function SeletorEmbalagem({
  valor,
  aoMudar,
}: {
  valor: TipoEmbalagem;
  aoMudar: (v: TipoEmbalagem) => void;
}) {
  return (
    <View style={st.seletor}>
      {(['CX', 'UN'] as const).map((t) => (
        <Pressable
          key={t}
          onPress={() => aoMudar(t)}
          style={[st.opcao, valor === t && st.opcaoAtiva]}
          accessibilityRole="button"
          accessibilityState={{ selected: valor === t }}
        >
          <Text style={[st.opcaoTexto, valor === t && st.opcaoTextoAtivo]}>{t}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** [-] quantidade [+] com teclado numérico. */
export function Stepper({ texto, aoMudar }: { texto: string; aoMudar: (texto: string) => void }) {
  const n = lerNumero(texto);
  const passo = (d: number) => {
    const atual = Number.isNaN(n) ? 0 : n;
    const novo = Math.max(0, Math.round((atual + d) * 1000) / 1000);
    aoMudar(formatarNumeroEntrada(novo));
  };
  return (
    <View style={st.stepper}>
      <Pressable style={st.passo} onPress={() => passo(-1)} accessibilityLabel="Diminuir">
        <Text style={st.passoTexto}>−</Text>
      </Pressable>
      <TextInput
        value={texto}
        onChangeText={(t) => aoMudar(t.replace(/[^\d,.]/g, ''))}
        keyboardType="decimal-pad"
        selectTextOnFocus
        style={st.qtd}
        accessibilityLabel="Quantidade"
      />
      <Pressable style={st.passo} onPress={() => passo(1)} accessibilityLabel="Aumentar">
        <Text style={st.passoTexto}>+</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  seletor: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: cores.primaria,
    overflow: 'hidden',
  },
  opcao: { paddingHorizontal: 16, height: 44, justifyContent: 'center' },
  opcaoAtiva: { backgroundColor: cores.primaria },
  opcaoTexto: { fontSize: 16, fontWeight: '700', color: cores.primaria },
  opcaoTextoAtivo: { color: '#FFFFFF' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  passo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passoTexto: { fontSize: 24, fontWeight: '700', color: cores.primaria, marginTop: -2 },
  qtd: {
    width: 64,
    height: 44,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: cores.texto,
    backgroundColor: '#FFFFFF',
  },
});
