import { describe, expect, it } from 'vitest';
import { calcularProgresso } from '../src/modules/app-builds/progresso';

const inicio = new Date('2026-11-28T12:00:00Z');
const minutos = (m: number) => new Date(inicio.getTime() + m * 60_000);
const passos = (atual: string) => {
  const nomes = [
    'Set up job',
    'Avisar o portal que começou',
    'Run actions/checkout@v4',
    'Run pnpm/action-setup@v4',
    'Run actions/setup-node@v4',
    'Instalar dependências do app',
    'Gerar APK na Expo',
    'Avisar o portal que terminou',
  ];
  const i = nomes.indexOf(atual);
  return nomes.map((name, k) => ({
    name,
    status: k < i ? 'completed' : k === i ? 'in_progress' : 'queued',
  }));
};

describe('progresso da geração do APK', () => {
  it('na fila: fica no começo da barra', () => {
    const p = calcularProgresso({ solicitadoEm: inicio, agora: minutos(1), passos: null });
    expect(p.etapa).toBe('Na fila do GitHub');
    expect(p.percentual).toBeLessThanOrEqual(3);
    expect(p.restanteSeg).toBe(16 * 60);
  });

  it('etapas rápidas avançam pela etapa', () => {
    const p = calcularProgresso({
      solicitadoEm: inicio,
      agora: minutos(1),
      passos: passos('Instalar dependências do app'),
    });
    expect(p.etapa).toBe('Instalando dependências');
    expect(p.percentual).toBe(12);
  });

  it('na Expo avança pelo tempo, usando o último build como referência', () => {
    const ref = 20 * 60_000;
    const meio = calcularProgresso({
      solicitadoEm: inicio,
      agora: minutos(10),
      passos: passos('Gerar APK na Expo'),
      duracaoReferenciaMs: ref,
    });
    expect(meio.etapa).toMatch(/Expo/);
    expect(meio.percentual).toBe(50);
    expect(meio.restanteSeg).toBe(600);
  });

  it('nunca chega a 100% antes de terminar, mesmo passando da estimativa', () => {
    const p = calcularProgresso({
      solicitadoEm: inicio,
      agora: minutos(60),
      passos: passos('Gerar APK na Expo'),
    });
    expect(p.percentual).toBe(95);
    expect(p.restanteSeg).toBeNull();
  });

  it('nunca volta para trás: etapa adiantada fica no início da faixa dela', () => {
    const p = calcularProgresso({
      solicitadoEm: inicio,
      agora: minutos(1),
      passos: passos('Gerar APK na Expo'),
    });
    expect(p.percentual).toBe(22);
  });

  it('ignora as etapas de limpeza do GitHub no fim (Post Run ...)', () => {
    const fim = [
      ...passos('Avisar o portal que terminou').map((x) => ({ ...x, status: 'completed' })),
      { name: 'Post Run actions/checkout@v4', status: 'completed' },
      { name: 'Complete job', status: 'in_progress' },
    ];
    const p = calcularProgresso({ solicitadoEm: inicio, agora: minutos(17), passos: fim });
    expect(p.etapa).toBe('Finalizando');
    expect(p.percentual).toBe(98);
  });
});
