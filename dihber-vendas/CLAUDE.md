# DihberVendas

Sistema de pedidos de venda: app mobile (Expo) + web (React) + API (Fastify/Prisma).
Especificação completa: docs/DihberVendas-Especificacao.md — siga-a.

## Comandos

- pnpm install
- docker compose up -d # Postgres
- cp apps/api/.env.example apps/api/.env
- pnpm db:migrate && pnpm db:seed
- pnpm dev # API (3333) + Web (5173)
- pnpm --filter mobile start # App (Expo)
- pnpm test # usa o banco dihber_vendas_test (criado via migrate deploy)

## Regras

- Tudo em TypeScript estrito. Interface e mensagens em português do Brasil.
- Schemas e regras de cálculo ficam em packages/shared e são usados por api, web e mobile.
- Permissões sempre validadas no servidor (ADMIN, SUPERVISOR, VENDEDOR).
- Nunca excluir cadastros fisicamente: usar ativo=false.
- Pedido tem id UUID gerado no app; /sync/pedidos deve ser idempotente.
- Servidor recalcula totais do pedido; não confiar no app.
- Escreva testes para regras de negócio e rotas de sync.
