// 本地 SQLite 客户端适配器（仅用于测试 / 离线运行）
// 用 Deno 内置的 node:sqlite 实现与 @libsql/client 相同的最小接口子集，
// 使 src/sqldb.ts 无需改动即可在本地跑真实 SQL。
import { DatabaseSync } from "node:sqlite";
import type { Client } from "@libsql/client/web";

type Stmt = string | { sql: string; args?: unknown[] };

function norm(s: Stmt): { sql: string; args: unknown[] } {
  return typeof s === "string" ? { sql: s, args: [] } : { sql: s.sql, args: s.args ?? [] };
}

/** 创建本地 SQLite 客户端；path 传 ":memory:" 或文件路径 */
export function createLocalClient(path: string): Client {
  const db = new DatabaseSync(path);

  const exec = (sql: string, args: unknown[]) => {
    const stmt = db.prepare(sql);
    const bind = args as never[];
    const isRead = /^\s*(select|pragma|with)\b/i.test(sql);
    if (isRead) {
      const rows = stmt.all(...bind) as unknown as Record<string, unknown>[];
      return { rows, columns: rows.length ? Object.keys(rows[0]) : [], rowsAffected: 0, lastInsertRowid: undefined };
    }
    const info = stmt.run(...bind);
    return {
      rows: [],
      columns: [],
      rowsAffected: Number(info.changes ?? 0),
      lastInsertRowid: info.lastInsertRowid as unknown as bigint | undefined,
    };
  };

  const client = {
    execute(s: Stmt) {
      const { sql, args } = norm(s);
      return Promise.resolve(exec(sql, args));
    },
    batch(stmts: Stmt[], _mode?: string) {
      const out: unknown[] = [];
      db.exec("begin");
      try {
        for (const s of stmts) {
          const { sql, args } = norm(s);
          out.push(exec(sql, args));
        }
        db.exec("commit");
      } catch (e) {
        db.exec("rollback");
        throw e;
      }
      return Promise.resolve(out);
    },
    executeMultiple(sql: string) {
      db.exec(sql);
      return Promise.resolve();
    },
    close() {
      db.close();
    },
    closed: false,
    protocol: "file",
  };

  return client as unknown as Client;
}
