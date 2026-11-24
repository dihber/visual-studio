import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import type { StatusPedido } from '@dihber/shared';
import { cores } from '../lib/tema';
import type { PedidoLocal } from '../db/repositorio';

type Variante = 'primario' | 'secundario' | 'perigo' | 'sucesso';

export function Botao({
  titulo,
  onPress,
  variante = 'primario',
  carregando,
  desabilitado,
  grande,
  estilo,
  icone,
  contador,
}: {
  titulo: string;
  onPress: () => void;
  variante?: Variante;
  carregando?: boolean;
  desabilitado?: boolean;
  grande?: boolean;
  estilo?: StyleProp<ViewStyle>;
  icone?: string;
  contador?: number;
}) {
  const fundo = {
    primario: cores.primaria,
    secundario: '#FFFFFF',
    perigo: cores.perigo,
    sucesso: cores.sucesso,
  }[variante];
  const corTexto = variante === 'secundario' ? cores.primaria : '#FFFFFF';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={desabilitado || carregando}
      style={({ pressed }) => [
        s.botao,
        grande && s.botaoGrande,
        { backgroundColor: fundo, opacity: desabilitado ? 0.5 : pressed ? 0.85 : 1 },
        variante === 'secundario' && { borderWidth: 1.5, borderColor: cores.primaria },
        estilo,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={corTexto} />
      ) : (
        <Text style={[s.botaoTexto, grande && s.botaoTextoGrande, { color: corTexto }]}>
          {icone ? `${icone}  ` : ''}
          {titulo}
        </Text>
      )}
      {!!contador && (
        <View style={s.contador}>
          <Text style={s.contadorTexto}>{contador}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Campo({ rotulo, ...props }: TextInputProps & { rotulo?: string }) {
  return (
    <View style={{ gap: 6 }}>
      {rotulo && <Text style={s.rotulo}>{rotulo}</Text>}
      <TextInput
        placeholderTextColor={cores.textoFraco}
        {...props}
        style={[s.input, props.style]}
      />
    </View>
  );
}

export function Cartao({
  children,
  estilo,
}: {
  children: ReactNode;
  estilo?: StyleProp<ViewStyle>;
}) {
  return <View style={[s.cartao, estilo]}>{children}</View>;
}

const INFO_STATUS: Record<
  StatusPedido | 'NAO_ENVIADO',
  { icone: string; texto: string; cor: string; fundo: string }
> = {
  NAO_ENVIADO: { icone: '⚪', texto: 'Não enviado', cor: '#475569', fundo: '#F1F5F9' },
  PENDENTE: { icone: '🟡', texto: 'Pendente', cor: '#92400E', fundo: '#FEF3C7' },
  APROVADO: { icone: '🟢', texto: 'Aprovado', cor: '#065F46', fundo: '#D1FAE5' },
  REPROVADO: { icone: '🔴', texto: 'Reprovado', cor: '#991B1B', fundo: '#FEE2E2' },
  CANCELADO: { icone: '⚫', texto: 'Cancelado', cor: '#334155', fundo: '#E2E8F0' },
};

export function statusDoPedido(p: Pick<PedidoLocal, 'situacao' | 'status'>) {
  return INFO_STATUS[p.situacao === 'NAO_ENVIADO' ? 'NAO_ENVIADO' : (p.status ?? 'PENDENTE')];
}

export function SeloStatus({ pedido }: { pedido: Pick<PedidoLocal, 'situacao' | 'status'> }) {
  const i = statusDoPedido(pedido);
  return (
    <View style={[s.selo, { backgroundColor: i.fundo }]}>
      <Text style={[s.seloTexto, { color: i.cor }]}>
        {i.icone} {i.texto}
      </Text>
    </View>
  );
}

export function Vazio({ texto }: { texto: string }) {
  return <Text style={s.vazio}>{texto}</Text>;
}

export const s = StyleSheet.create({
  botao: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  botaoGrande: { minHeight: 64, borderRadius: 14 },
  botaoTexto: { fontSize: 16, fontWeight: '700' },
  botaoTextoGrande: { fontSize: 19, letterSpacing: 0.5 },
  contador: {
    position: 'absolute',
    right: 14,
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  contadorTexto: { color: cores.perigo, fontWeight: '800', fontSize: 15 },
  rotulo: { fontSize: 14, fontWeight: '600', color: cores.textoSecundario },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 17,
    backgroundColor: '#FFFFFF',
    color: cores.texto,
  },
  cartao: {
    backgroundColor: cores.cartao,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  selo: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  seloTexto: { fontSize: 13, fontWeight: '600' },
  vazio: { textAlign: 'center', color: cores.textoFraco, padding: 32, fontSize: 15 },
});
