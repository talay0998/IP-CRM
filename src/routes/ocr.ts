// 腾讯云 OCR 路由：营业执照 / 身份证识别（MDD-API-001 中间件保护）
import { Hono } from "hono";
import type { Db } from "../db.ts";
import type { Vars } from "../auth.ts";
import { writeLog } from "../log.ts";
import { ocrRecognize, tencentCredFromEnv } from "../tencent.ts";

export function createOcrRoutes(db: Db) {
  const app = new Hono<{ Variables: Vars }>();

  // 校验请求体中的图片 base64（去除 dataURI 前缀）
  function imageBase64(body: Record<string, unknown>): string {
    const raw = typeof body.image === "string" ? body.image.trim() : "";
    if (!raw) throw new Error("缺少 image 字段（图片 base64）");
    const b64 = raw.startsWith("data:") ? raw.slice(raw.indexOf(",") + 1) : raw;
    if (b64.length < 64) throw new Error("图片数据过短");
    return b64;
  }

  app.post("/biz-license", async (c) => {
    const cred = tencentCredFromEnv();
    if (!cred) return c.json({ error: "未配置腾讯云 OCR 密钥（TENCENT_SECRET_ID/KEY）" }, 400);
    const body = await c.req.json().catch(() => null) ?? {};
    try {
      const r = await ocrRecognize(cred, "BizLicenseOCR", { ImageBase64: imageBase64(body) });
      await writeLog(db, c.get("username"), "客户", "OCR识别", "营业执照识别");
      return c.json({
        name: r.Name ?? "",
        regNum: r.RegNum ?? "",
        address: r.Address ?? "",
        legalPerson: r.LegalPerson ?? "",
        type: r.Type ?? "",
      });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "营业执照识别失败" }, 400);
    }
  });

  app.post("/id-card", async (c) => {
    const cred = tencentCredFromEnv();
    if (!cred) return c.json({ error: "未配置腾讯云 OCR 密钥（TENCENT_SECRET_ID/KEY）" }, 400);
    const body = await c.req.json().catch(() => null) ?? {};
    try {
      const r = await ocrRecognize(cred, "IDCardOCR", { ImageBase64: imageBase64(body) });
      await writeLog(db, c.get("username"), "客户", "OCR识别", "身份证识别");
      return c.json({
        name: r.Name ?? "",
        idNum: r.IdNum ?? "",
        address: r.Address ?? "",
        sex: r.Sex ?? "",
      });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "身份证识别失败" }, 400);
    }
  });

  return app;
}
