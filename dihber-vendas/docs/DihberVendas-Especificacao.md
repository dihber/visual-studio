# DihberVendas — Especificação de Desenvolvimento

> Documento-guia para desenvolvimento com **Claude Code**.
> Sistema de **Pedidos de Venda** com **App Mobile (iOS/Android)** + **Portal Web** + **API**.

---

## 1. Visão Geral

O vendedor faz o pedido de venda no **celular** (funciona mesmo sem internet). Ao tocar em **Sincronizar**, o app:

1. **Envia** os pedidos feitos para o servidor;
2. **Recebe** os dados novos/alterados cadastrados na web (clientes, produtos, etc.).

No **Portal Web**, o administrador cadastra usuários, vendedores, supervisores, clientes e produtos, e acompanha **todos os pedidos**, podendo **aprovar ou reprovar**. Cada pedido registra **qual vendedor**, **qual celular** e **qual cliente**.

O **supervisor** vê as vendas apenas dos vendedores da sua equipe.

```
┌──────────────┐   Sincronizar (HTTPS/JSON)   ┌──────────────┐        ┌──────────────┐
│  App Mobile  │ ───── envia pedidos ───────▶ │     API      │ ◀────▶ │  PostgreSQL  │
│ (offline +   │ ◀──── recebe cadastros ───── │  (Node/TS)   │        └──────────────┘
│  SQLite)     │                              └──────▲───────┘
└──────────────┘                                     │
                                              ┌──────┴───────┐
                                              │  Portal Web  │
                                              │ (cadastros + │
                                              │   pedidos)   │
                                              └──────────────┘
```

---

## 2. Stack Tecnológica (recomendada)

Tudo em **TypeScript** — uma única linguagem no app, na web e na API. Isso facilita muito o trabalho no Claude Code (tipos compartilhados, menos erros de integração).

| Camada | Tecnologia | Por quê |
|---|---|---|
| **Monorepo** | pnpm workspaces + Turborepo | Um repositório só, tipos compartilhados |
| **API (backend)** | Node.js 20+ · **Fastify** · **Prisma ORM** · **Zod** | Simples, rápido, validação forte |
| **Banco de dados** | **PostgreSQL** 16 | Robusto, gratuito |
| **Autenticação** | JWT (access + refresh) · senha com **bcrypt** | Padrão de mercado |
| **Portal Web** | **React + Vite** · **TanStack Query** · **Tailwind CSS** · **shadcn/ui** | Interface limpa e objetiva |
| **App Mobile** | **React Native + Expo** (iOS e Android) · **expo-sqlite** · **Expo Router** | Um código para os dois sistemas, funciona offline |
| **Validação compartilhada** | Pacote `shared` com schemas Zod | Mesmo contrato no app, web e API |
| **Infra local** | Docker Compose (Postgres) | Sobe o banco com 1 comando |
| **Build do app** | EAS Build (Expo) | Gera `.apk`/`.aab` e `.ipa` |

---

## 3. Perfis de Acesso

| Perfil | Onde acessa | O que pode fazer |
|---|---|---|
| **ADMIN** | Web | Tudo: cadastros, usuários, ver/aprovar/reprovar todos os pedidos |
| **SUPERVISOR** | Web (e app, consulta) | Ver pedidos e vendas **dos vendedores da sua equipe**; aprovar/reprovar pedidos da equipe |
| **VENDEDOR** | App | Login, sincronizar, criar pedidos, ver os próprios pedidos |

### Regras de vínculo
- Ao cadastrar um **usuário**, escolhe-se o **perfil** (Admin, Supervisor ou Vendedor).
- Se o perfil for **Vendedor**, o usuário **deve ser vinculado a um registro de Vendedor**.
- Se o perfil for **Supervisor**, o usuário **deve ser vinculado a um registro de Supervisor**.
- Cada **Vendedor** pertence a **um Supervisor** (equipe). Um Supervisor tem **N vendedores**.

---

## 4. Modelo de Dados

### 4.1 Diagrama

```
Supervisor 1───N Vendedor 1───N Pedido N───1 Cliente
    │               │              │
    │               │              └──1───N PedidoItem N───1 Produto
    │               │
Usuario (perfil) ───┘ (vinculado a Vendedor OU Supervisor)

Dispositivo N───1 Usuario   (celular que fez login/sincronizou)
```

### 4.2 Schema Prisma (base)

```prisma
enum Perfil        { ADMIN SUPERVISOR VENDEDOR }
enum StatusPedido  { PENDENTE APROVADO REPROVADO CANCELADO }
enum TipoEmbalagem { CX UN }

model Usuario {
  id            String      @id @default(uuid())
  nome          String
  login         String      @unique
  senhaHash     String
  perfil        Perfil
  ativo         Boolean     @default(true)
  vendedorId    String?     @unique
  vendedor      Vendedor?   @relation(fields: [vendedorId], references: [id])
  supervisorId  String?     @unique
  supervisor    Supervisor? @relation(fields: [supervisorId], references: [id])
  dispositivos  Dispositivo[]
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}

model Supervisor {
  id         String     @id @default(uuid())
  codigo     String     @unique
  nome       String
  email      String?
  telefone   String?
  ativo      Boolean    @default(true)
  vendedores Vendedor[]
  usuario    Usuario?
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
}

model Vendedor {
  id           String      @id @default(uuid())
  codigo       String      @unique
  nome         String
  email        String?
  telefone     String?
  ativo        Boolean     @default(true)
  supervisorId String?
  supervisor   Supervisor? @relation(fields: [supervisorId], references: [id])
  usuario      Usuario?
  pedidos      Pedido[]
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
}

model Cliente {
  id           String   @id @default(uuid())
  codigo       String   @unique
  razaoSocial  String
  nomeFantasia String?
  cpfCnpj      String   @unique
  telefone     String?
  email        String?
  endereco     String?
  cidade       String?
  uf           String?  @db.Char(2)
  ativo        Boolean  @default(true)
  pedidos      Pedido[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Produto {
  id             String   @id @default(uuid())
  codigo         String   @unique
  descricao      String
  embalagem      String            // texto exibido, ex.: "CX C/ 12 UN"
  qtdPorCaixa    Int               // fator de conversão: 1 CX = N UN
  precoUnitario  Decimal  @db.Decimal(12, 2)   // preço da UN
  estoque        Decimal? @db.Decimal(12, 3)   // opcional
  ativo          Boolean  @default(true)
  itens          PedidoItem[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model Dispositivo {
  id            String   @id @default(uuid())
  deviceId      String   @unique    // gerado/obtido no app
  modelo        String?             // ex.: "Samsung SM-A155M"
  sistema       String?             // ex.: "Android 14"
  appVersao     String?
  usuarioId     String
  usuario       Usuario  @relation(fields: [usuarioId], references: [id])
  ultimoSync    DateTime?
  pedidos       Pedido[]
  createdAt     DateTime @default(now())
}

model Pedido {
  id              String       @id            // UUID gerado NO APP (idempotência)
  numero          Int          @unique @default(autoincrement())
  vendedorId      String
  vendedor        Vendedor     @relation(fields: [vendedorId], references: [id])
  clienteId       String
  cliente         Cliente      @relation(fields: [clienteId], references: [id])
  dispositivoId   String
  dispositivo     Dispositivo  @relation(fields: [dispositivoId], references: [id])
  status          StatusPedido @default(PENDENTE)
  observacao      String?
  valorTotal      Decimal      @db.Decimal(12, 2)
  criadoNoAppEm   DateTime                  // data/hora local do celular
  recebidoEm      DateTime     @default(now())
  avaliadoPorId   String?                   // usuário que aprovou/reprovou
  avaliadoEm      DateTime?
  motivoReprovacao String?
  itens           PedidoItem[]
  updatedAt       DateTime     @updatedAt
}

model PedidoItem {
  id             String        @id @default(uuid())
  pedidoId       String
  pedido         Pedido        @relation(fields: [pedidoId], references: [id], onDelete: Cascade)
  produtoId      String
  produto        Produto       @relation(fields: [produtoId], references: [id])
  tipoEmbalagem  TipoEmbalagem              // CX ou UN
  quantidade     Decimal       @db.Decimal(12, 3)
  qtdUnidades    Decimal       @db.Decimal(12, 3) // quantidade convertida em UN
  precoUnitario  Decimal       @db.Decimal(12, 2) // preço da UN no momento do pedido
  valorTotal     Decimal       @db.Decimal(12, 2)
}
```

### 4.3 Regras de cálculo do item
- Se `tipoEmbalagem = CX` → `qtdUnidades = quantidade × produto.qtdPorCaixa`
- Se `tipoEmbalagem = UN` → `qtdUnidades = quantidade`
- `valorTotal = qtdUnidades × precoUnitario`
- O **servidor recalcula** tudo ao receber (não confia no valor enviado pelo app).

> ⚠️ **Decisão a confirmar:** preço. O documento assume preço por unidade no cadastro do produto. Se não houver preço (só quantidade), remover `precoUnitario`/`valorTotal`.

---

## 5. Sincronização (o coração do sistema)

### 5.1 Princípios
- O app é **offline-first**: clientes e produtos ficam salvos no **SQLite** do celular.
- O pedido é criado localmente com **UUID** e status local `NAO_ENVIADO`.
- O botão **Sincronizar** faz, nesta ordem:
  1. **ENVIAR** pedidos `NAO_ENVIADO` → `POST /sync/pedidos`
  2. **RECEBER** alterações desde o último sync → `GET /sync/dados?desde=<timestamp>`
  3. **RECEBER** status atualizado dos pedidos do vendedor (aprovado/reprovado)
  4. Gravar `ultimoSync` localmente e exibir resumo.

### 5.2 Idempotência
- O `id` do pedido é gerado no app. Se a internet cair no meio do envio e o vendedor sincronizar de novo, o servidor **não duplica**: se o `id` já existe, apenas confirma.

### 5.3 Sincronização incremental (delta)
- Toda tabela tem `updatedAt`. O app envia `desde = data do último sync`.
- A API devolve só registros com `updatedAt > desde` (incluindo os inativados, com `ativo=false`, para o app remover/ocultar).
- Primeiro login: `desde` vazio → carga completa.

### 5.4 Resposta do envio de pedidos
```json
{
  "aceitos":   [{ "id": "uuid", "numero": 1042 }],
  "rejeitados":[{ "id": "uuid", "erro": "Cliente inativo" }]
}
```
Pedidos aceitos passam a `ENVIADO` no app e mostram o **número** do servidor. Rejeitados ficam marcados com o erro para o vendedor corrigir.

### 5.5 Resposta do recebimento
```json
{
  "servidorAgora": "2026-11-24T10:00:00Z",
  "clientes":  [ ... ],
  "produtos":  [ ... ],
  "statusPedidos": [{ "id": "uuid", "status": "APROVADO", "motivoReprovacao": null }]
}
```
O app usa `servidorAgora` como próximo `desde` (evita problema de relógio do celular errado).

---

## 6. API — Endpoints

Base: `/api/v1` · Autenticação: `Authorization: Bearer <token>`

### Autenticação
| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/login` | `{ login, senha, dispositivo }` → tokens + dados do usuário |
| POST | `/auth/refresh` | Renova o token |
| POST | `/auth/logout` | Encerra sessão |

### Cadastros (Web — ADMIN)
| Recurso | Rotas |
|---|---|
| Usuários | `GET/POST /usuarios` · `GET/PUT/PATCH /usuarios/:id` · `PATCH /usuarios/:id/senha` |
| Supervisores | `GET/POST /supervisores` · `GET/PUT /supervisores/:id` |
| Vendedores | `GET/POST /vendedores` · `GET/PUT /vendedores/:id` |
| Clientes | `GET/POST /clientes` · `GET/PUT /clientes/:id` |
| Produtos | `GET/POST /produtos` · `GET/PUT /produtos/:id` |

- Listagens com `?busca=&pagina=&porPagina=&ativo=`.
- **Não excluir fisicamente**: usar `ativo=false` (inativar), para não quebrar pedidos antigos e para o sync propagar.

### Pedidos (Web)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/pedidos` | Filtros: status, vendedor, supervisor, cliente, período, dispositivo |
| GET | `/pedidos/:id` | Detalhe com itens |
| POST | `/pedidos/:id/aprovar` | ADMIN ou SUPERVISOR da equipe |
| POST | `/pedidos/:id/reprovar` | `{ motivo }` obrigatório |
| GET | `/pedidos/exportar` | CSV/Excel com filtros aplicados |

### Sync (App — VENDEDOR)
| Método | Rota | Descrição |
|---|---|---|
| POST | `/sync/pedidos` | Envia lote de pedidos |
| GET | `/sync/dados?desde=` | Recebe clientes, produtos e status de pedidos |

### Regra de visibilidade (aplicar em TODAS as consultas de pedidos)
- **ADMIN**: todos.
- **SUPERVISOR**: `pedido.vendedor.supervisorId = usuario.supervisorId`.
- **VENDEDOR**: `pedido.vendedorId = usuario.vendedorId`.

---

## 7. Portal Web — Telas

Layout: **menu lateral** + área principal. Visual limpo, poucos cliques, tabelas com busca.

```
┌─────────────┬────────────────────────────────────────────┐
│ DihberVendas│  Pedidos                      [Exportar]   │
│             │  [Status ▼] [Vendedor ▼] [Período] [Buscar]│
│ ▸ Pedidos   │  ┌──────┬──────────┬─────────┬──────┬─────┐│
│ ▸ Clientes  │  │ Nº   │ Cliente  │Vendedor │Total │Stat.││
│ ▸ Produtos  │  ├──────┼──────────┼─────────┼──────┼─────┤│
│ ▸ Vendedores│  │ 1042 │ Merc. X  │ João    │ 850  │ 🟡  ││
│ ▸ Superv.   │  │ 1041 │ Pad. Y   │ Maria   │ 320  │ 🟢  ││
│ ▸ Usuários  │  └──────┴──────────┴─────────┴──────┴─────┘│
│             │                                            │
│ [Sair]      │                                            │
└─────────────┴────────────────────────────────────────────┘
```

### 7.1 Login
- Login e senha. Vendedor **não** acessa a web (só app).

### 7.2 Pedidos (tela inicial)
- Lista com: **Nº, Data, Cliente, Vendedor, Supervisor, Celular (modelo), Qtd itens, Total, Status**.
- Filtros: status, vendedor, supervisor, cliente, período.
- Badges de status: 🟡 Pendente · 🟢 Aprovado · 🔴 Reprovado.
- Contadores no topo: *Pendentes hoje*, *Aprovados*, *Reprovados*, *Total vendido no período*.
- **Detalhe do pedido**: cabeçalho (cliente, vendedor, celular, data no app, data recebida) + tabela de itens (código, descrição, embalagem, tipo CX/UN, quantidade, qtd em UN, preço, total) + botões **Aprovar** / **Reprovar** (com motivo).

### 7.3 Cadastro de Usuários
- Campos: nome, login, senha (e confirmar), **perfil** (Admin / Supervisor / Vendedor), ativo.
- Se **Vendedor** → combo obrigatório "Qual vendedor?".
- Se **Supervisor** → combo obrigatório "Qual supervisor?".
- Ação "Redefinir senha".
- Ver dispositivos (celulares) que esse usuário já usou.

### 7.4 Cadastro de Supervisores
- Código, nome, e-mail, telefone, ativo.
- Lista dos vendedores da equipe (somente leitura, com link).

### 7.5 Cadastro de Vendedores
- Código, nome, e-mail, telefone, **supervisor** (combo), ativo.

### 7.6 Cadastro de Clientes
- Código, razão social, nome fantasia, CPF/CNPJ (com validação), telefone, e-mail, endereço, cidade, UF, ativo.
- (Futuro opcional) vincular clientes a vendedores específicos (carteira).

### 7.7 Cadastro de Produtos
- Código, descrição, embalagem (texto, ex.: "CX C/ 12 UN"), **quantidade por caixa**, preço unitário, estoque (opcional), ativo.

### 7.8 Visão do Supervisor
- Mesmo menu de Pedidos, já filtrado para sua equipe.
- Painel "Vendas da equipe": total por vendedor no período (tabela simples + gráfico de barras).
- Supervisor **não** vê menus de cadastro (exceto consulta de clientes/produtos).

---

## 8. App Mobile — Telas

Princípios: **botões grandes**, **poucas telas**, **busca rápida**, funciona **sem internet**.

### 8.1 Login
```
┌──────────────────────┐
│     DihberVendas     │
│                      │
│  Usuário [_________] │
│  Senha   [_________] │
│                      │
│     [  ENTRAR  ]     │
└──────────────────────┘
```
- Primeiro login exige internet (valida e faz carga inicial).
- Depois, o app mantém sessão; se o token expirar sem internet, permite continuar criando pedidos e pede login novamente no próximo sync.
- Usuário **precisa estar vinculado a um vendedor**; se não estiver, mostra mensagem clara.

### 8.2 Início (Home)
```
┌──────────────────────────┐
│ Olá, João   (Vendedor 07)│
│ Último sync: hoje 08:15  │
│                          │
│ [ 🔄 SINCRONIZAR ]  (3) │ ← nº de pedidos não enviados
│                          │
│ [ ➕ NOVO PEDIDO ]       │
│                          │
│ Meus pedidos             │
│ #1042 Merc. X  🟡 R$850  │
│ (novo) Pad. Y  ⚪ R$320  │ ← ⚪ não enviado
└──────────────────────────┘
```

### 8.3 Novo Pedido — Passo 1: Cliente
- Campo de busca (código, nome, CNPJ) → lista → toca para selecionar.

### 8.4 Novo Pedido — Passo 2: Produtos
```
┌──────────────────────────────┐
│ Cliente: Mercado X       [✎] │
│ [🔍 Buscar produto...      ] │
│ ──────────────────────────── │
│ 00123                        │
│ ARROZ TIPO 1 5KG             │
│ Emb.: CX C/ 6 UN             │
│ ( CX | UN )   [-] 2 [+]  [+] │
│ ──────────────────────────── │
│ Itens no pedido: 4           │
│ Total: R$ 850,00  [REVISAR ▶]│
└──────────────────────────────┘
```
- Cada produto mostra **código, descrição e embalagem**.
- Seletor **CX / UN** + quantidade (teclado numérico).
- Mostra a conversão: "2 CX = 12 UN".
- Mesmo produto adicionado de novo → soma no item existente (mesmo tipo de embalagem).

### 8.5 Novo Pedido — Passo 3: Revisão
- Lista de itens (editar quantidade / remover), observação, total.
- Botão **SALVAR PEDIDO** → salva localmente como "não enviado".
- Opção "Salvar e sincronizar agora" se houver internet.

### 8.6 Meus Pedidos / Detalhe
- Status: ⚪ Não enviado · 🟡 Pendente · 🟢 Aprovado · 🔴 Reprovado (mostra motivo).
- Pedido **não enviado** pode ser editado ou excluído. Depois de enviado, **não** pode ser alterado.

### 8.7 Sincronizar
- Tela/modal de progresso: "Enviando 3 pedidos… ✓", "Recebendo clientes (12 novos)… ✓", "Recebendo produtos (5 alterados)… ✓", "Status de pedidos atualizado ✓".
- Em caso de erro: mensagem simples e opção **Tentar novamente**. Nada se perde.

### 8.8 Dados do dispositivo
- No login e em cada sync o app envia: `deviceId` (persistido), modelo, sistema e versão do app — é isso que permite saber **de qual celular** veio o pedido.

---

## 9. Estrutura do Projeto (monorepo)

```
dihber-vendas/
├── CLAUDE.md                 # instruções para o Claude Code (ver seção 12)
├── docker-compose.yml        # PostgreSQL
├── package.json / pnpm-workspace.yaml / turbo.json
├── packages/
│   └── shared/               # schemas Zod, tipos, enums, regras de cálculo
│       └── src/
│           ├── schemas/
│           ├── calculo-pedido.ts
│           └── index.ts
├── apps/
│   ├── api/                  # Fastify + Prisma
│   │   ├── prisma/schema.prisma
│   │   ├── prisma/seed.ts
│   │   └── src/
│   │       ├── modules/{auth,usuarios,supervisores,vendedores,clientes,produtos,pedidos,sync}/
│   │       ├── plugins/       # auth, cors, erro
│   │       └── server.ts
│   ├── web/                  # React + Vite + Tailwind + shadcn/ui
│   │   └── src/{pages,components,api,hooks,layouts}/
│   └── mobile/               # Expo + React Native + expo-sqlite
│       └── app/              # Expo Router
│           ├── (auth)/login.tsx
│           ├── (app)/index.tsx          # Home
│           ├── (app)/pedido/novo/*.tsx  # cliente → produtos → revisão
│           ├── (app)/pedido/[id].tsx
│           └── ...
│       └── src/{db,sync,api,components}/
└── docs/
    └── DihberVendas-Especificacao.md   # este documento
```

---

## 10. Requisitos Não Funcionais

- **Segurança**: senhas com bcrypt; JWT com expiração curta (15 min) + refresh (30 dias); HTTPS obrigatório em produção; rate-limit no login.
- **Permissões**: checadas **no servidor** em toda rota (nunca só na tela).
- **Auditoria**: registrar quem aprovou/reprovou e quando.
- **Desempenho**: app deve buscar produto em < 300 ms com 10.000 produtos (índices no SQLite).
- **Datas**: salvar em UTC; exibir em horário de Brasília.
- **Moeda/números**: formato brasileiro (R$ 1.234,56).
- **Logs**: erros da API com contexto (usuário, rota).

---

## 11. Plano de Desenvolvimento (fases)

Faça uma fase por vez no Claude Code. Teste antes de seguir.

| Fase | Entrega | Critério de pronto |
|---|---|---|
| **0. Base** | Monorepo, Docker Postgres, pacote `shared`, lint/format | `pnpm dev` sobe API e Web |
| **1. API + Banco** | Prisma schema, migrations, seed (1 admin, 1 supervisor, 2 vendedores, 10 clientes, 20 produtos) | `pnpm db:seed` funciona |
| **2. Auth** | Login, refresh, perfis, middleware de permissão | Testes de login e acesso negado |
| **3. Cadastros API** | CRUD de usuários, supervisores, vendedores, clientes, produtos | Testes de cada rota |
| **4. Web — Cadastros** | Login web, layout, telas de cadastro | Admin cadastra tudo pela web |
| **5. Sync API** | `/sync/pedidos` (idempotente) e `/sync/dados` (delta) | Testes: reenvio não duplica; delta correto |
| **6. App — Base** | Expo, login, SQLite, carga inicial | App loga e lista produtos offline |
| **7. App — Pedido** | Fluxo cliente → produtos (CX/UN) → revisão → salvar | Pedido salvo offline |
| **8. App — Sincronizar** | Botão sincronizar completo | Pedido aparece na web |
| **9. Web — Pedidos** | Lista, filtros, detalhe, aprovar/reprovar, exportar | Status volta para o app no sync |
| **10. Supervisor** | Visibilidade por equipe + painel de vendas | Supervisor só vê sua equipe |
| **11. Publicação** | Deploy API/Web, build EAS (Android/iOS) | App instalado em celular real |

---

## 12. CLAUDE.md sugerido (colocar na raiz do projeto)

```markdown
# DihberVendas

Sistema de pedidos de venda: app mobile (Expo) + web (React) + API (Fastify/Prisma).
Especificação completa: docs/DihberVendas-Especificacao.md — siga-a.

## Comandos
- pnpm install
- docker compose up -d        # Postgres
- pnpm db:migrate && pnpm db:seed
- pnpm dev                    # API + Web
- pnpm --filter mobile start  # App (Expo)
- pnpm test

## Regras
- Tudo em TypeScript estrito. Interface e mensagens em português do Brasil.
- Schemas e regras de cálculo ficam em packages/shared e são usados por api, web e mobile.
- Permissões sempre validadas no servidor (ADMIN, SUPERVISOR, VENDEDOR).
- Nunca excluir cadastros fisicamente: usar ativo=false.
- Pedido tem id UUID gerado no app; /sync/pedidos deve ser idempotente.
- Servidor recalcula totais do pedido; não confiar no app.
- Escreva testes para regras de negócio e rotas de sync.
- Trabalhe uma fase por vez (seção 11 da especificação) e confirme antes de avançar.
```

---

## 13. Prompts prontos para o Claude Code

Use em sequência:

1. *"Leia docs/DihberVendas-Especificacao.md e execute a **Fase 0 e Fase 1**. Ao final, me mostre como rodar."*
2. *"Execute a **Fase 2 e 3** (auth e CRUDs da API) com testes."*
3. *"Execute a **Fase 4**: portal web com login e telas de cadastro, interface simples com shadcn/ui."*
4. *"Execute a **Fase 5**: endpoints de sincronização, com testes de idempotência e delta."*
5. *"Execute as **Fases 6, 7 e 8**: app Expo com login, SQLite, fluxo de novo pedido com CX/UN e botão Sincronizar."*
6. *"Execute a **Fase 9 e 10**: tela de pedidos na web com aprovar/reprovar e visão do supervisor."*
7. *"Execute a **Fase 11**: prepare deploy e build EAS para Android e iOS."*

---

## 14. Pontos a Decidir

- [ ] **Preço**: o pedido terá valores (R$) ou só quantidades?
- [ ] **Carteira de clientes**: todo vendedor vê todos os clientes, ou só os da sua carteira?
- [ ] **Estoque**: validar estoque no pedido ou só informativo?
- [ ] **Supervisor no app**: precisa ver as vendas da equipe também pelo celular, ou só na web?
- [ ] **Integração ERP** (futuro): exportar pedidos aprovados para o ERP (ex.: TOTVS) via arquivo ou API.
- [ ] **Hospedagem**: onde rodar API/Web/Banco (ex.: VPS, Railway, Render, AWS).
- [ ] **Publicação iOS**: requer conta Apple Developer (US$ 99/ano); Android: Google Play (US$ 25 único) ou distribuição direta do APK.
