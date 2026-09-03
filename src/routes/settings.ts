// 系统设置路由：系统标题 / 联系人 / SMTP 配置（含测试连接、发送测试邮件、到期提醒）
import { Hono } from "hono";
import type { Db } from "../db.ts";
import type { SmtpConfig, OcrConfig, AppSettings } from "../types.ts";
import { defaultSettings, now, toStr } from "../types.ts";
import type { Vars } from "../auth.ts";
import { writeLog } from "../log.ts";
import { sendEmail, testSmtp } from "../smtp.ts";
import { buildReminderEmail, runReminder } from "../reminders.ts";

export function createSettingsRoutes(db: Db) {
  const app = new Hono<{ Variables: Vars }>();

  app.get("/", async (c) => {
    return c.json((await db.getSettings()) ?? defaultSettings());
  });

  app.put("/", async (c) => {
    const body = await c.req.json().catch(() => null) ?? {};
    const cur = (await db.getSettings()) ?? defaultSettings();
    const smtpRaw = body.smtp ?? {};
    const contactRaw = body.contact ?? {};
    const smtpRaw0 = body.smtp ?? {};
    const smtp: SmtpConfig = {
      host: toStr(smtpRaw0.host),
      port: Number.isInteger(smtpRaw0.port) ? smtpRaw0.port : cur.smtp.port,
      username: toStr(smtpRaw0.username),
      password: smtpRaw0.password === undefined ? cur.smtp.password : toStr(smtpRaw0.password),
      from: toStr(smtpRaw0.from),
      secure: typeof smtpRaw0.secure === "boolean" ? smtpRaw0.secure : cur.smtp.secure,
      enabled: typeof smtpRaw0.enabled === "boolean" ? smtpRaw0.enabled : cur.smtp.enabled,
    };
    if (smtp.host && (smtp.port < 1 || smtp.port > 65535)) {
      return c.json({ error: "SMTP 端口不合法" }, 400);
    }
    const ocrRaw = body.ocr ?? {};
    const ocr: OcrConfig = {
      secretId: toStr(ocrRaw.secretId),
      secretKey: ocrRaw.secretKey === undefined ? cur.ocr.secretKey : toStr(ocrRaw.secretKey),
      region: toStr(ocrRaw.region) || cur.ocr.region || "ap-guangzhou",
      enabled: typeof ocrRaw.enabled === "boolean" ? ocrRaw.enabled : cur.ocr.enabled,
    };
    const companyRaw = body.company ?? {};
    const company = {
      fullName: toStr(companyRaw.fullName) || cur.company.fullName,
      shortName: toStr(companyRaw.shortName) || cur.company.shortName,
      address: toStr(companyRaw.address) || cur.company.address,
      scope: toStr(companyRaw.scope) || cur.company.scope,
      business: toStr(companyRaw.business) || cur.company.business,
      icp: toStr(companyRaw.icp) || cur.company.icp,
      website: toStr(companyRaw.website) || cur.company.website,
      logo: toStr(companyRaw.logo) || cur.company.logo,
    };
    const next = {
      siteTitle: toStr(body.siteTitle).trim() || cur.siteTitle,
      contact: {
        name: toStr(contactRaw.name),
        company: toStr(contactRaw.company),
        phone: toStr(contactRaw.phone),
        email: toStr(contactRaw.email),
      },
      company,
      smtp,
      ocr,
      updatedAt: now(),
    };
    await db.setSettings(next);
    await writeLog(db, c.get("username"), "系统", "更新配置", "系统设置（标题/联系人/公司信息/SMTP）");
    return c.json(next);
  });

  // 腾讯云 OCR 配置读写（GET 读取 / PUT 保存，保存时密码为空则保留原值）
  app.get("/ocr", async (c) => {
    const cur = (await db.getSettings()) ?? defaultSettings();
    return c.json({ secretId: cur.ocr.secretId, secretKey: cur.ocr.secretKey, region: cur.ocr.region, enabled: cur.ocr.enabled });
  });

  app.put("/ocr", async (c) => {
    const body = await c.req.json().catch(() => null) ?? {};
    const cur = (await db.getSettings()) ?? defaultSettings();
    const next: AppSettings = {
      ...cur,
      ocr: {
        secretId: toStr(body.secretId),
        secretKey: body.secretKey === undefined || body.secretKey === null ? cur.ocr.secretKey : toStr(body.secretKey),
        region: toStr(body.region) || cur.ocr.region || "ap-guangzhou",
        enabled: typeof body.enabled === "boolean" ? body.enabled : cur.ocr.enabled,
      },
      updatedAt: now(),
    };
    await db.setSettings(next);
    await writeLog(db, c.get("username"), "系统", "更新配置", "腾讯云 OCR 配置");
    const out = { ...next.ocr };
    return c.json(out);
  });

  app.post("/test-smtp", async (c) => {
    const body = await c.req.json().catch(() => null) ?? {};
    const smtpRaw = body.smtp ?? {};
    const cfg: SmtpConfig = {
      host: toStr(smtpRaw.host),
      port: Number.isInteger(smtpRaw.port) ? smtpRaw.port : 465,
      username: toStr(smtpRaw.username),
      password: toStr(smtpRaw.password),
      from: toStr(smtpRaw.from),
      secure: typeof smtpRaw.secure === "boolean" ? smtpRaw.secure : true,
      enabled: false,
    };
    const result = await testSmtp(cfg);
    return c.json(result);
  });

  app.post("/send-test", async (c) => {
    const body = await c.req.json().catch(() => null) ?? {};
    const settings = (await db.getSettings()) ?? defaultSettings();
    const cfg = settings.smtp;
    if (!cfg.host) return c.json({ ok: false, message: "尚未配置 SMTP，请先在通知配置中填写并保存" }, 400);
    if (!cfg.enabled) return c.json({ ok: false, message: "SMTP 未启用（enabled=false）" }, 400);
    const to = toStr(body.to).trim() || settings.contact.email;
    if (!to) return c.json({ ok: false, message: "请填写收件地址，或先在联系人中配置邮箱" }, 400);
    const result = await sendEmail(cfg, {
      to,
      subject: `【${settings.siteTitle}】测试邮件`,
      body: `这是一封来自 ${settings.siteTitle} 的测试邮件。\n\n发送时间：${new Date().toLocaleString("zh-CN")}\n\n如果收到此邮件，说明 SMTP 配置正常。`,
    });
    if (result.ok) await writeLog(db, c.get("username"), "系统", "发送测试邮件", `收件人 ${to}`);
    else await writeLog(db, c.get("username"), "系统", "发送测试邮件失败", result.message);
    return c.json(result);
  });

  app.post("/reminders-run", async (c) => {
    const settings = (await db.getSettings()) ?? defaultSettings();
    const cfg = settings.smtp;
    if (!cfg.host) return c.json({ ok: false, message: "尚未配置 SMTP" }, 400);
    const to = settings.contact.email || Deno.env.get("REMINDER_TO") || "";
    if (!to) return c.json({ ok: false, message: "未配置收件邮箱（联系人邮箱或 REMINDER_TO）" }, 400);
    const { items, email } = await buildReminderEmail(db, to);
    if (email === null) return c.json({ ok: true, message: "当前没有需要提醒的期限", count: 0 });
    const result = await sendEmail(cfg, email);
    if (result.ok) {
      await writeLog(db, c.get("username"), "系统", "发送到期提醒", `${items.length} 项 → ${to}`);
      return c.json({ ok: true, count: items.length, to, message: `已发送 ${items.length} 项到期提醒` });
    }
    await writeLog(db, c.get("username"), "系统", "发送到期提醒失败", result.message);
    return c.json(result);
  });

  return app;
}
