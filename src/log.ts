// 操作日志写入 helper
import type { Db } from "./db.ts";
import { newId, now } from "./types.ts";

export async function writeLog(
  db: Db,
  operator: string,
  module: string,
  action: string,
  detail: string,
): Promise<void> {
  await db.addLog({ id: newId(), operator, module, action, detail, createdAt: now() });
}
