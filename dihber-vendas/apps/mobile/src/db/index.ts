import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('dihber-vendas.db');

const MIGRACOES: string[] = [
  `
  CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY NOT NULL, valor TEXT);
  CREATE TABLE IF NOT EXISTS clientes (
    id TEXT PRIMARY KEY NOT NULL,
    codigo TEXT NOT NULL,
    razaoSocial TEXT NOT NULL,
    nomeFantasia TEXT,
    cpfCnpj TEXT NOT NULL,
    telefone TEXT,
    cidade TEXT,
    uf TEXT,
    busca TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_clientes_codigo ON clientes(codigo);
  CREATE INDEX IF NOT EXISTS idx_clientes_razao ON clientes(razaoSocial);
  CREATE TABLE IF NOT EXISTS produtos (
    id TEXT PRIMARY KEY NOT NULL,
    codigo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    embalagem TEXT NOT NULL,
    qtdPorCaixa INTEGER NOT NULL,
    precoUnitario REAL NOT NULL,
    estoque REAL,
    busca TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_produtos_codigo ON produtos(codigo);
  CREATE INDEX IF NOT EXISTS idx_produtos_descricao ON produtos(descricao);
  CREATE TABLE IF NOT EXISTS pedidos (
    id TEXT PRIMARY KEY NOT NULL,
    clienteId TEXT NOT NULL,
    clienteNome TEXT NOT NULL,
    clienteCodigo TEXT NOT NULL,
    observacao TEXT,
    valorTotal REAL NOT NULL,
    criadoNoAppEm TEXT NOT NULL,
    situacao TEXT NOT NULL DEFAULT 'NAO_ENVIADO',
    numero INTEGER,
    status TEXT,
    motivoReprovacao TEXT,
    erroEnvio TEXT,
    enviadoEm TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_pedidos_situacao ON pedidos(situacao);
  CREATE TABLE IF NOT EXISTS pedido_itens (
    id TEXT PRIMARY KEY NOT NULL,
    pedidoId TEXT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    produtoId TEXT NOT NULL,
    codigo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    embalagem TEXT NOT NULL,
    qtdPorCaixa INTEGER NOT NULL,
    tipoEmbalagem TEXT NOT NULL,
    quantidade REAL NOT NULL,
    qtdUnidades REAL NOT NULL,
    precoUnitario REAL NOT NULL,
    valorTotal REAL NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_itens_pedido ON pedido_itens(pedidoId);
  `,
  // v2: motivo do cancelamento feito no portal
  `ALTER TABLE pedidos ADD COLUMN motivoCancelamento TEXT;`,
];

export function migrarBanco() {
  db.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const atual = db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
  for (let v = atual; v < MIGRACOES.length; v++) {
    db.withTransactionSync(() => {
      db.execSync(MIGRACOES[v]);
      db.execSync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

export function lerMeta(chave: string): string | null {
  return (
    db.getFirstSync<{ valor: string | null }>('SELECT valor FROM meta WHERE chave = ?', [chave])
      ?.valor ?? null
  );
}

export function gravarMeta(chave: string, valor: string | null) {
  db.runSync(
    'INSERT INTO meta (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor',
    [chave, valor],
  );
}

/** Apaga todos os dados locais (troca de usuário no aparelho). */
export function limparDadosLocais() {
  db.withTransactionSync(() => {
    db.execSync(
      'DELETE FROM pedido_itens; DELETE FROM pedidos; DELETE FROM clientes; DELETE FROM produtos; DELETE FROM meta;',
    );
  });
}
