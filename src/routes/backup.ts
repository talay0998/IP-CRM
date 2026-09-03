// 数据备份路由：JSON 导出 / 恢复 / Turso 云端快照
import { Hono } from "hono";
import type { Db } from "../db.ts";
import type { BackupData } from "../db.ts";
import { now } from "../types.ts";
import type { Vars } from "../auth.ts";
import { writeLog } from "../log.ts";
import { createTursoClient, listSnapshots, pullLatestSnapshot, pushSnapshot } from "../turso.ts";

function ts() {
  const d = new Date(now());
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function isValidBackup(v: unknown): v is BackupData {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    Array.isArray(o.customers) &&
    Array.isArray(o.cases) &&
    Array.isArray(o.activities) &&
    Array.isArray(o.fees) &&
    Array.isArray(o.deadlines) &&
    (o.leads === undefined || Array.isArray(o.leads))
  );
}

export function createBackupRoutes(db: Db) {
  const app = new Hono<{ Variables: Vars }>();

  app.get("/export", async (c) => {
    const data = await db.listAllData();
    const body = JSON.stringify(data, null, 2);
    c.header("Content-Type", "application/json; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="ip-crm-backup-${ts()}.json"`);
    await writeLog(db, c.get("username"), "系统", "导出", "导出全量数据备份（JSON）");
    return c.body(body, 200);
  });

  app.get("/meta", async (c) => {
    const data = await db.listAllData();
    return c.json({
      customers: data.customers.length,
      cases: data.cases.length,
      activities: data.activities.length,
      fees: data.fees.length,
      deadlines: data.deadlines.length,
      leads: data.leads.length,
    });
  });

  app.post("/restore", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!isValidBackup(body)) return c.json({ error: "备份文件格式不正确" }, 400);
    const n = { ...body };
    await db.importAllData(n);
    await writeLog(
      db,
      c.get("username"),
      "系统",
      "导入",
      `恢复备份：客户 ${n.customers.length}、案件 ${n.cases.length}、费用 ${n.fees.length}`,
    );
    return c.json({ ok: true });
  });

  // ---- Turso 云端快照备份 ----

  app.get("/turso/status", async (c) => {
    const client = createTursoClient();
    if (!client) return c.json({ configured: false });
    try {
      const snaps = await listSnapshots(client, 5);
      return c.json({ configured: true, snapshots: snaps });
    } catch (e) {
      return c.json({ configured: true, error: e instanceof Error ? e.message : "连接失败", snapshots: [] });
    } finally {
      client.close();
    }
  });

  app.post("/turso/push", async (c) => {
    const client = createTursoClient();
    if (!client) return c.json({ error: "未配置 TURSO_URL / TURSO_AUTH_TOKEN" }, 400);
    try {
      const data = await db.listAllData();
      const id = await pushSnapshot(client, data);
      await writeLog(
        db,
        c.get("username"),
        "系统",
        "导出",
        `备份到 Turso 云端：客户 ${data.customers.length}、案件 ${data.cases.length}`,
      );
      return c.json({ ok: true, id });
    } catch (e) {
      return c.json({ ok: false, message: e instanceof Error ? e.message : "备份失败" }, 502);
    } finally {
      client.close();
    }
  });

  app.get("/turso/list", async (c) => {
    const client = createTursoClient();
    if (!client) return c.json({ error: "未配置 TURSO_URL / TURSO_AUTH_TOKEN" }, 400);
    try {
      return c.json({ snapshots: await listSnapshots(client, 20) });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "连接失败" }, 502);
    } finally {
      client.close();
    }
  });

  app.post("/turso/restore", async (c) => {
    const client = createTursoClient();
    if (!client) return c.json({ error: "未配置 TURSO_URL / TURSO_AUTH_TOKEN" }, 400);
    try {
      const data = await pullLatestSnapshot(client);
      if (!data) return c.json({ error: "云端还没有任何备份快照" }, 404);
      await db.importAllData(data);
      await writeLog(
        db,
        c.get("username"),
        "系统",
        "导入",
        `从 Turso 云端恢复：客户 ${data.customers.length}、案件 ${data.cases.length}`,
      );
      return c.json({ ok: true });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "恢复失败" }, 502);
    } finally {
      client.close();
    }
  });

  return app;
}
