// 业务元数据路由：业务类型/子类、期限规则建议、公司展示信息
import { Hono } from "hono";
import type { Db } from "../db.ts";
import type { Vars } from "../auth.ts";
import {
  CASE_TYPES,
  CATEGORIES_BY_TYPE,
  CASE_TYPE_LABEL,
  LEAD_SOURCES,
  LEAD_SOURCE_LABEL,
  LEAD_STATUSES,
  LEAD_STATUS_LABEL,
  defaultSettings,
} from "../types.ts";
import { suggestedDeadlines } from "../rules.ts";

export function createMetaRoutes(db: Db) {
  const app = new Hono<{ Variables: Vars }>();

  // 业务类型与子类字典（供前端动态渲染下拉）
  app.get("/business", (c) => {
    const types = CASE_TYPES.map((t) => ({
      value: t,
      label: CASE_TYPE_LABEL[t as keyof typeof CASE_TYPE_LABEL] ?? t,
      categories: [...(CATEGORIES_BY_TYPE[t] ?? [])],
    }));
    return c.json(types);
  });

  // 销售线索字典
  app.get("/leads-dict", (c) => {
    return c.json({
      sources: LEAD_SOURCES.map((s) => ({ value: s, label: LEAD_SOURCE_LABEL[s as keyof typeof LEAD_SOURCE_LABEL] ?? s })),
      statuses: LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABEL[s as keyof typeof LEAD_STATUS_LABEL] ?? s })),
    });
  });

  // 根据业务类型/子类/日期推荐官方期限
  app.post("/deadline-suggest", async (c) => {
    const body = await c.req.json().catch(() => null) ?? {};
    const type = typeof body.type === "string" ? body.type : "";
    const category = typeof body.category === "string" ? body.category : "";
    const date = typeof body.date === "string" ? body.date : undefined;
    const suggestions = suggestedDeadlines({ type, category, date });
    return c.json({ suggestions });
  });

  // 公司对外展示信息（供"关于我们"页）
  app.get("/company", async (c) => {
    const settings = (await db.getSettings()) ?? defaultSettings();
    return c.json({ siteTitle: settings.siteTitle, contact: settings.contact, company: settings.company });
  });

  return app;
}
