// 操作日志路由
import { Hono } from "hono";
import type { Db } from "../db.ts";
import type { Vars } from "../auth.ts";
import { writeLog } from "../log.ts";

export function createLogsRoutes(db: Db) {
  const app = new Hono<{ Variables: Vars }>();

  app.get("/", async (c) => {
    const raw = c.req.query("limit");
    const limit = raw && Number.isInteger(Number(raw)) ? Math.max(1, Math.min(500, Number(raw))) : 200;
    let list = await db.listLogs(limit);
    list.sort((a, b) => b.createdAt - a.createdAt);
    return c.json(list);
  });

  app.delete("/", async (c) => {
    await db.clearLogs();
    await writeLog(db, c.get("username"), "系统", "清空日志", "清空全部操作日志");
    return c.json({ ok: true });
  });

  return app;
}
