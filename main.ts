// 应用入口（仅负责装配与启动）
import { createSqlDb, initSchema } from "./src/sqldb.ts";
import { createAuth } from "./src/auth.ts";
import { createApp } from "./src/app.ts";
import { defaultSettings } from "./src/types.ts";
import { createTursoClient, pushSnapshot } from "./src/turso.ts";
import { runReminder } from "./src/reminders.ts";

// 主数据库：统一走 SQL（libSQL）。
// 配置了 TURSO_URL 则连接 Turso 云端；否则回落到本地 SQLite 文件，便于离线开发。
// 两者共用同一套 SQL 数据层代码，行为一致。
const isDeploy = !!Deno.env.get("DENO_DEPLOYMENT_ID");
let client = createTursoClient();
if (!client) {
  if (isDeploy) {
    throw new Error("Deno Deploy 环境缺少 TURSO_URL / TURSO_AUTH_TOKEN，请在控制台配置环境变量后重新部署。");
  }
  const { createLocalClient } = await import("./src/localsql.ts");
  const file = Deno.env.get("SQLITE_PATH") || "./data/ipcrm.sqlite";
  await Deno.mkdir(file.slice(0, file.lastIndexOf("/")), { recursive: true }).catch(() => {});
  client = createLocalClient(file);
  console.log(`[db] 未配置 Turso，使用本地 SQLite：${file}`);
} else {
  console.log("[db] 已连接 Turso 云端数据库");
}
await initSchema(client);
const db = createSqlDb(client);

const USERNAME = Deno.env.get("IPCRM_USERNAME") ?? "alimjan";
const PASSWORD = Deno.env.get("IPCRM_PASSWORD") ?? "alimjan580";

const auth = createAuth(db, { username: USERNAME, password: PASSWORD });
const app = createApp(db, auth, USERNAME);

// 环境变量种子 SMTP 配置：仅当已有设置未配置 SMTP 时填入
const settings = (await db.getSettings()) ?? defaultSettings();
if (Deno.env.get("SMTP_HOST") && !settings.smtp.host) {
  settings.smtp = {
    host: Deno.env.get("SMTP_HOST")!,
    port: Number(Deno.env.get("SMTP_PORT") || (Deno.env.get("SMTP_SECURE") === "false" ? 587 : 465)),
    username: Deno.env.get("SMTP_USERNAME") ?? "",
    password: Deno.env.get("SMTP_PASSWORD") ?? "",
    from: Deno.env.get("SMTP_FROM") ?? "",
    secure: Deno.env.get("SMTP_SECURE") !== "false",
    enabled: Deno.env.get("SMTP_ENABLED") === "true",
  };
  if (!settings.contact.email) settings.contact.email = Deno.env.get("REMINDER_TO") ?? "";
  await db.setSettings(settings);
}

// 环境变量种子 OCR 配置：仅当已有设置未配置腾讯云 OCR 时填入
{
  const secretId = Deno.env.get("TENCENT_SECRET_ID");
  const secretKey = Deno.env.get("TENCENT_SECRET_KEY");
  if (secretId && secretKey && !settings.ocr.secretId) {
    settings.ocr = {
      secretId,
      secretKey,
      region: Deno.env.get("TENCENT_OCR_REGION") || "ap-guangzhou",
      enabled: true,
    };
    await db.setSettings(settings);
    console.log("[ocr] 已从环境变量写入腾讯云 OCR 配置");
  }
}

// ---- 定时任务：必须在模块顶层同步注册，否则 Deploy 无法完成 cron 注册 ----
// 每日 02:00 生成一份全量快照存入 backups 表（与主数据表相互独立）
Deno.cron("turso-backup", "0 2 * * *", async () => {
  try {
    const data = await db.listAllData();
    await pushSnapshot(client, data);
    console.log(`[turso] 自动备份完成（客户 ${data.customers.length} / 案件 ${data.cases.length}）`);
  } catch (e) {
    console.error("[turso] 自动备份失败:", e instanceof Error ? e.message : e);
  }
});
console.log("[turso] 主数据库已连接，每日 02:00 自动生成快照");

// 每日 09:00 发送到期提醒邮件
if (Deno.env.get("SMTP_ENABLED") === "true" || Deno.env.get("REMINDER_TO")) {
  Deno.cron("deadline-reminder", "0 9 * * *", async () => {
    try {
      const r = await runReminder(db);
      console.log(`[reminder] ${r.message}${r.count ? `（${r.count} 项 → ${r.to}）` : ""}`);
    } catch (e) {
      console.error("[reminder] 提醒发送失败:", e instanceof Error ? e.message : e);
    }
  });
  console.log("[reminder] 已启用，每日 09:00 发送到期提醒");
}

// 本地运行时自行监听端口；Deploy 由平台接管，通过 export default 提供 fetch
if (import.meta.main && !isDeploy) {
  const port = Number(Deno.env.get("PORT") || 8000);
  Deno.serve({ port }, app.fetch);
}

export default app;
