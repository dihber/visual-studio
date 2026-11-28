import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import type { DispositivoInput, Perfil } from '@dihber/shared';
import { APP_VERSAO } from '../lib/config';

export interface UsuarioApp {
  id: string;
  nome: string;
  login: string;
  perfil: Perfil;
  vendedor: { id: string; codigo: string; nome: string } | null;
}

export interface SessaoApp {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioApp;
}

const CHAVE_SESSAO = 'dihber.sessao';
const CHAVE_DEVICE = 'dihber.deviceId';

let cache: SessaoApp | null | undefined;

export async function carregarSessao(): Promise<SessaoApp | null> {
  if (cache !== undefined) return cache;
  const s = await SecureStore.getItemAsync(CHAVE_SESSAO);
  cache = s ? (JSON.parse(s) as SessaoApp) : null;
  return cache;
}

export async function salvarSessao(s: SessaoApp | null) {
  cache = s;
  if (s) await SecureStore.setItemAsync(CHAVE_SESSAO, JSON.stringify(s));
  else await SecureStore.deleteItemAsync(CHAVE_SESSAO);
}

/** Identificador persistente do aparelho (gerado no primeiro uso). */
export async function obterDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(CHAVE_DEVICE);
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync(CHAVE_DEVICE, id);
  }
  return id;
}

export async function dadosDispositivo(): Promise<DispositivoInput> {
  const modelo = [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || null;
  return {
    deviceId: await obterDeviceId(),
    modelo,
    // No Android, Device.osName pode trazer o "fingerprint" interno do sistema
    // (ex.: samsung/beyond0ltexx/...). Mostramos só "Android 12" / "iOS 18.1".
    sistema: `${Platform.OS === 'android' ? 'Android' : (Device.osName ?? 'iOS')} ${Device.osVersion ?? ''}`.trim(),
    appVersao: APP_VERSAO,
  };
}
