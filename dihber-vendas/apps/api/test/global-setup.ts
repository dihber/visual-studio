import { execSync } from 'node:child_process';

/** Cria/atualiza o banco de teste aplicando as migrations (os testes limpam as tabelas). */
export default function setup() {
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://dihber:dihber@localhost:5432/dihber_vendas_test?schema=public';
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
