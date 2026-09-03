// 组合根：组装认证 + 业务路由 + 静态服务（MDD-MOD-003）
import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import type { Db } from "./db.ts";
import type { Auth } from "./auth.ts";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "./auth.ts";
import { createCustomersRoutes } from "./routes/customers.ts";
import { createCasesRoutes } from "./routes/cases.ts";
import { createCaseFeesRoutes, createFeesRoutes } from "./routes/fees.ts";
import { createDeadlinesRoutes } from "./routes/deadlines.ts";
import { createDashboardRoutes } from "./routes/dashboard.ts";
import { createLogsRoutes } from "./routes/logs.ts";
import { createSettingsRoutes } from "./routes/settings.ts";
import { createBackupRoutes } from "./routes/backup.ts";
import { createExportRoutes } from "./routes/export.ts";
import { createStatsRoutes } from "./routes/stats.ts";
import { createFinanceRoutes } from "./routes/finance.ts";
import { createOcrRoutes } from "./routes/ocr.ts";
import { createLeadsRoutes } from "./routes/leads.ts";
import { createMetaRoutes } from "./routes/meta.ts";
import { writeLog } from "./log.ts";

export type AppVariables = { token: string };

export function createApp(db: Db, auth: Auth, username: string): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use("/api/*", auth.requireAuth);

  // ---- 认证端点 ----
  app.get("/api/health", (c) => c.json({ ok: true }));

  app.post("/api/login", async (c) => {
    const body = await c.req.json().catch(() => null);
    const token = await auth.login(body?.username ?? "", body?.password ?? "");
    if (!token) return c.json({ error: "账号或密码错误" }, 401);
    await writeLog(db, username, "认证", "登录", "用户登录系统");
    c.header(
      "Set-Cookie",
      `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_MAX_AGE}; SameSite=Lax`,
    );
    return c.json({ ok: true });
  });

  app.post("/api/logout", async (c) => {
    await auth.logout(c.get("token"));
    await writeLog(db, username, "认证", "登出", "用户退出系统");
    c.header("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0`);
    return c.json({ ok: true });
  });

  app.get("/api/me", (c) => c.json({ username }));

  // ---- 业务路由（按 RMD 顺序挂载）----
  app.route("/api/customers", createCustomersRoutes(db));
  app.route("/api/cases", createCasesRoutes(db));
  app.route("/api/cases", createCaseFeesRoutes(db));
  app.route("/api/fees", createFeesRoutes(db));
  app.route("/api/deadlines", createDeadlinesRoutes(db));
  app.route("/api/dashboard", createDashboardRoutes(db));
  app.route("/api/logs", createLogsRoutes(db));
  app.route("/api/settings", createSettingsRoutes(db));
  app.route("/api/backup", createBackupRoutes(db));
  app.route("/api/export", createExportRoutes(db));
  app.route("/api/stats", createStatsRoutes(db));
  app.route("/api/finance", createFinanceRoutes(db));
  app.route("/api/ocr", createOcrRoutes(db));
  app.route("/api/leads", createLeadsRoutes(db));
  app.route("/api/meta", createMetaRoutes(db));

  // ---- 静态服务 ----
  app.get("/", serveStatic({ path: "./public/index.html" }));
  app.get("*", serveStatic({ root: "./public" }));

  app.notFound((c) => {
    if (c.req.path.startsWith("/api/")) return c.json({ error: "接口不存在" }, 404);
    return c.text("Not Found", 404);
  });

  return app;
}
