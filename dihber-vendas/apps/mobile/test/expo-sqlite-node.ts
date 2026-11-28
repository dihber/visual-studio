// Implementação mínima da API síncrona do expo-sqlite sobre node:sqlite (somente testes).
import { DatabaseSync } from 'node:sqlite';

type Params = unknown[] | Record<string, unknown> | undefined;
const args = (p: Params) => (p === undefined ? [] : Array.isArray(p) ? p : [p]);

export function openDatabaseSync() {
  const db = new DatabaseSync(':memory:');
  const api = {
    execSync: (sql: string) => db.exec(sql),
    getFirstSync: <T>(sql: string, p?: Params) =>
      (db.prepare(sql).get(...(args(p) as never[])) ?? null) as T | null,
    getAllSync: <T>(sql: string, p?: Params) => db.prepare(sql).all(...(args(p) as never[])) as T[],
    runSync: (sql: string, p?: Params) => {
      const r = db.prepare(sql).run(...(args(p) as never[]));
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    withTransactionSync: (fn: () => void) => {
      db.exec('BEGIN');
      try {
        fn();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    prepareSync: (sql: string) => {
      const st = db.prepare(sql);
      return {
        executeSync: (p?: Params) => {
          const a = args(p) as never[];
          const leitura = /^\s*select/i.test(sql);
          const linhas = leitura ? st.all(...a) : (st.run(...a), []);
          return { getFirstSync: () => linhas[0] ?? null };
        },
        finalizeSync: () => undefined,
      };
    },
  };
  return api;
}
