// Turso 云端备份：全量数据快照（push / list / pull）
import { createClient } from "@libsql/client/web";
import type { Client } from "@libsql/client/web";
import type { BackupData } from "./db.ts";

/** 从环境变量创建 Turso 客户端；未配置返回 null */
export function createTursoClient(env = Deno.env): Client | null {
  const url = env.get("TURSO_URL");
  const token = env.get("TURSO_AUTH_TOKEN");
  if (!url || !token) return null;
  return createClient({ url, authToken: token });
}

export interface TursoSnapshotMeta {
  id: string;
  createdAt: number;
  counts: Record<string, number>;
}

const KEEP_SNAPSHOTS = 20;

async function ensureTables(client: Client): Promise<void> {
  await client.execute(`
    create table if not exists backups (
      id text primary key,
      created_at integer not null,
      data text not null,
      counts text not null
    )
  `);
}

function countsOf(data: BackupData): Record<string, number> {
  return {
    customers: data.customers.length,
    cases: data.cases.length,
    activities: data.activities.length,
    fees: data.fees.length,
    deadlines: data.deadlines.length,
    leads: data.leads.length,
  };
}

/** 推送一份全量快照到 Turso；返回快照 id */
export async function pushSnapshot(client: Client, data: BackupData): Promise<string> {
  await ensureTables(client);
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  await client.execute({
    sql: "insert into backups (id, created_at, data, counts) values (?, ?, ?, ?)",
    args: [id, createdAt, JSON.stringify(data), JSON.stringify(countsOf(data))],
  });
  const prune = await client.execute({
    sql: "select id from backups order by created_at desc limit -1 offset ?",
    args: [KEEP_SNAPSHOTS],
  });
  for (const row of prune.rows) {
    await client.execute({ sql: "delete from backups where id = ?", args: [String(row.id)] });
  }
  return id;
}

/** 列出最近快照元信息（不含数据体） */
export async function listSnapshots(client: Client, limit = 10): Promise<TursoSnapshotMeta[]> {
  await ensureTables(client);
  const r = await client.execute({
    sql: "select id, created_at, counts from backups order by created_at desc limit ?",
    args: [limit],
  });
  return r.rows.map((row) => ({
    id: String(row.id),
    createdAt: Number(row.created_at),
    counts: JSON.parse(String(row.counts)) as Record<string, number>,
  }));
}

/** 拉取最新一份快照的数据；无快照返回 null */
export async function pullLatestSnapshot(client: Client): Promise<BackupData | null> {
  await ensureTables(client);
  const r = await client.execute("select data from backups order by created_at desc limit 1");
  if (r.rows.length === 0) return null;
  return JSON.parse(String(r.rows[0].data)) as BackupData;
}
