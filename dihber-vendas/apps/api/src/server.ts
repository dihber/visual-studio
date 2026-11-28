import { criarApp } from './app';
import { criarAdminInicial } from './lib/admin-inicial';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('JWT_SECRET não definido. Configure a variável de ambiente.');
  process.exit(1);
}

const app = await criarApp({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    transport: undefined,
  },
});

const port = Number(process.env.PORT ?? 3333);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await criarAdminInicial(app.log);
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, async () => {
    await app.close();
    process.exit(0);
  });
}
