# DihberVendas

Sistema de **pedidos de venda** com **app mobile offline (iOS/Android)**, **portal web** e **API**.
Especificação: [`docs/DihberVendas-Especificacao.md`](docs/DihberVendas-Especificacao.md).

```
apps/api      Fastify + Prisma + PostgreSQL (auth JWT, cadastros, pedidos, sync)
apps/web      React + Vite + Tailwind + TanStack Query (portal admin/supervisor)
apps/mobile   Expo (React Native) + expo-router + expo-sqlite (app do vendedor, offline)
packages/shared  Schemas Zod, enums, cálculo do pedido, CPF/CNPJ, formatação pt-BR
```

## Como rodar (desenvolvimento)

Pré-requisitos: Node 20+, pnpm 10+, Docker (ou um PostgreSQL 16 local).

```bash
pnpm install
docker compose up -d                       # PostgreSQL na porta 5432
cp apps/api/.env.example apps/api/.env
pnpm db:migrate && pnpm db:seed
pnpm dev                                   # API em :3333 e Web em http://localhost:5173
```

Usuários do seed:

| Login        | Senha      | Perfil                         |
| ------------ | ---------- | ------------------------------ |
| `admin`      | `admin123` | Administrador (web)            |
| `supervisor` | `super123` | Supervisor da equipe S01 (web) |
| `vendedor1`  | `vend123`  | Vendedor 07 – João (app)       |
| `vendedor2`  | `vend123`  | Vendedor 08 – Maria (app)      |

### App no celular

```bash
cp apps/mobile/.env.example apps/mobile/.env   # ajuste o IP do computador na rede
pnpm --filter mobile start                     # abra no Expo Go ou em um development build
```

O celular precisa alcançar a API pelo IP da rede (ex.: `http://192.168.0.10:3333/api/v1`), não por `localhost`.

### APK de teste (Android, API local via HTTP)

O perfil `teste` do `apps/mobile/eas.json` gera um APK que aceita `http://` (apps Android de verdade bloqueiam HTTP por padrão). Ele se chama **DihberVendas (teste)** e usa o pacote `br.com.dihber.vendas.teste`, então pode ficar instalado junto com o app oficial. Builds de produção continuam aceitando só HTTPS.

1. Em `apps/mobile/eas.json`, perfil `teste`, troque `192.168.0.10` pelo IP do seu computador.
2. Gere o APK (precisa de conta gratuita em expo.dev):
   ```bash
   cd apps/mobile && npx eas-cli login
   ```
   ```bash
   pnpm --filter mobile build:teste
   ```
3. Baixe o `.apk` pelo link que a Expo mostra e instale no celular (permita "instalar de fontes desconhecidas").

O endereço da API fica gravado no APK: se o IP do computador mudar, gere o APK de novo (ou fixe o IP no roteador).

### Testes

```bash
pnpm test        # shared (cálculo/CPF/CNPJ), API (46 testes com Postgres) e app (unitários)
# integração app ⇄ API (código real do app contra a API rodando com seed):
API_E2E_URL=http://localhost:3333/api/v1 pnpm --filter mobile test
```

Os testes da API usam o banco `dihber_vendas_test` (criado/atualizado com `prisma migrate deploy`; as tabelas são limpas a cada arquivo).
Use `TEST_DATABASE_URL` para apontar para outro servidor.

## O que está implementado

**API** (`/api/v1`)

- `POST /auth/login|refresh|logout`, `GET /auth/me` — JWT de 15 min + refresh token de 30 dias (rotacionado e revogável), bcrypt, rate limit no login (por IP + login).
- Cadastros com busca/paginação/filtro `ativo`, **sem exclusão física** (`PATCH /:id {ativo}`): usuários (+ `PATCH /usuarios/:id/senha`, dispositivos), supervisores, vendedores, clientes (CPF/CNPJ validado), produtos.
- Pedidos: lista com filtros (status, vendedor, supervisor, cliente, período, dispositivo, busca), detalhe, aprovar/reprovar (motivo obrigatório, auditoria de quem/quando), `GET /pedidos/resumo` (contadores), `GET /pedidos/vendas-equipe`, `GET /pedidos/exportar` (CSV para Excel).
- Sync: `POST /sync/pedidos` **idempotente** (UUID do app; reenvio e envio concorrente não duplicam) e com **recálculo no servidor**; `GET /sync/dados?desde=` **delta** (inclui inativados) + status dos pedidos; `servidorAgora` vira o próximo `desde`.
- Visibilidade aplicada em todas as consultas: ADMIN tudo · SUPERVISOR só a equipe · VENDEDOR só os próprios.

**Portal web** — login (vendedor é bloqueado), menu lateral por perfil, pedidos com contadores/filtros/exportação, detalhe com aprovar/reprovar, painel "Vendas da equipe" (gráfico + tabela), cadastros completos (usuário com vínculo obrigatório a vendedor/supervisor, redefinir senha, celulares usados; equipe do supervisor). Supervisor vê só Pedidos, Vendas da equipe e consulta de Clientes/Produtos.

**App** — login (exige vínculo com vendedor; primeiro acesso faz a carga inicial), Home com último sync e contador de não enviados, novo pedido em 3 passos (cliente → produtos com **CX/UN**, conversão "2 CX = 12 UN" e soma de item repetido → revisão), editar/excluir pedido não enviado, tela de sincronização por etapas com "Tentar novamente" e "Entrar novamente" quando a sessão expira (pedidos continuam sendo feitos offline). Envia `deviceId`, modelo, sistema e versão do app.

## Decisões tomadas (seção 14 da especificação)

| Ponto                                           | Decisão adotada (fácil de mudar)                                                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Preço                                           | Pedido **com valores (R$)**; preço da UN vem do cadastro e o servidor recalcula.                                        |
| Carteira de clientes                            | Todo vendedor vê **todos** os clientes ativos.                                                                          |
| Estoque                                         | **Informativo** (exibido no app, não bloqueia o pedido).                                                                |
| Supervisor no app                               | **Só web**. O app é exclusivo para vendedores (admin/supervisor recebem mensagem clara).                                |
| Troca de vendedor no mesmo celular              | Permitida; os dados locais são trocados, **exceto** se houver pedidos não enviados do anterior (bloqueia com mensagem). |
| Período nos filtros                             | Usa a data do pedido no app (`criadoNoAppEm`), em horário de Brasília. "Total vendido" soma pendentes + aprovados.      |
| Integração ERP, hospedagem, contas Apple/Google | Pendentes — dependem de você.                                                                                           |

### Carteira, tabelas de preço e formas de pagamento

- **Carteira:** no cadastro do cliente, marque os vendedores que podem vender para ele. O app só mostra os clientes da carteira do vendedor; cliente sem vendedor não aparece para ninguém. Na primeira atualização com essa função, todos os clientes que já existiam foram vinculados a todos os vendedores que já existiam, para ninguém perder clientes; ajuste a carteira de cada um no portal.
- **Tabelas de preço** (menu _Tabelas de preço_): preço da unidade por produto e por região (ex.: Itupeva/SP, Cuiabá/MT). Vincule a tabela no cadastro do cliente. Produto sem preço na tabela (ou cliente sem tabela, ou tabela inativa) usa o preço base do produto. O servidor recalcula com o preço da tabela.
- **Prazos** (menu _Prazos_): cadastro livre dos prazos de boleto (ex.: "30 dias", "30/60 dias"), vinculados a cada cliente. No app, ao finalizar o pedido, o vendedor escolhe **PIX** (sempre disponível) ou **Boleto** em um dos prazos do cliente. O servidor recusa prazo que não pertence ao cliente.
- Pedidos de versões antigas do app (sem forma de pagamento) continuam sendo aceitos e aparecem como "Não informado".

### Comissão e estoque reservado

- **Comissão:** no cadastro do produto, informe o **% de comissão** do vendedor. Ao receber cada pedido, o sistema grava em uma tabela própria (`ComissaoItem`) a comissão de cada item: valor vendido × %, com o % daquele dia. Ex.: 10 itens de R$ 10,00 com 5% = R$ 5,00. Mudar o % depois não altera pedidos antigos.
- **Relatório de comissões** (menu _Comissões_): por vendedor e mês do pedido (horário de Brasília). Faturamento e comissão contam só pedidos **faturados**; a coluna _Previsão_ mostra os aprovados ainda não faturados. Supervisor vê só a equipe.
- **Estoque reservado:** pedidos pendentes e aprovados reservam o estoque (em UN); reprovar ou cancelar libera. A baixa do saldo total acontece ao **faturar**. Na lista de produtos, clique no disponível para ver saldo total, reservado e disponível; clique em _Reservado_ para ver os pedidos.
- **Sem saldo, não vende:** o app mostra o disponível e não deixa passar dele (descontando também os pedidos do celular ainda não enviados); o servidor recusa o pedido se, no sync, não houver saldo. Produto sem estoque cadastrado não tem controle.

### Perdi a senha do admin

No Railway, serviço **api** › **Variables**, crie `ADMIN_REDEFINIR_SENHA` com a senha nova (mínimo 8 caracteres) e aplique. Ao reiniciar, a API troca a senha do usuário `admin` (e o reativa, se estiver inativo). **Depois de entrar, apague a variável**: enquanto ela existir, cada reinício redefine a senha.

## Publicação (Fase 11)

- **API + Web**: `docker-compose.prod.yml` (Postgres + API + Nginx servindo o web e fazendo proxy de `/api`). Defina `JWT_SECRET` e `POSTGRES_PASSWORD` e coloque HTTPS na frente (Caddy/Traefik/Certbot). A API aplica as migrations ao subir.
- **App**: `apps/mobile/eas.json` tem perfis `preview` (APK para instalar direto) e `production`. Ajuste `EXPO_PUBLIC_API_URL` para o domínio HTTPS e rode `eas build -p android --profile preview` / `eas build -p ios --profile production` (requer conta Expo; iOS requer Apple Developer).
- Bundle ID / package: `br.com.dihber.vendas` (altere em `apps/mobile/app.json` se quiser).
