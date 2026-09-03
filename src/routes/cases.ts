// 案件 + 节点路由（MDD-MOD-003）
import { Hono } from "hono";
import type { Db } from "../db.ts";
import type { Case, CaseActivity } from "../types.ts";
import {
  CASE_STATUSES,
  CASE_TYPES,
  newId,
  now,
  toStr,
  isValidCaseCategory,
} from "../types.ts";
import type { Vars } from "../auth.ts";
import { writeLog } from "../log.ts";

function isCaseStatus(v: unknown): boolean {
  return typeof v === "string" && (CASE_STATUSES as readonly string[]).includes(v);
}
function isCaseType(v: unknown): boolean {
  return typeof v === "string" && (CASE_TYPES as readonly string[]).includes(v);
}

export function createCasesRoutes(db: Db) {
  const app = new Hono<{ Variables: Vars }>();

  app.get("/", async (c) => {
    const q = (c.req.query("q") ?? "").trim().toLowerCase();
    const type = c.req.query("type");
    const status = c.req.query("status");
    const customerId = c.req.query("customerId");
    let list = await db.listCases();
    if (type) list = list.filter((x) => x.type === type);
    if (status) list = list.filter((x) => x.status === status);
    if (customerId) list = list.filter((x) => x.customerId === customerId);
    if (q) {
      list = list.filter((x) => [x.title, x.appNo, x.category, x.stage].some((f) => f.toLowerCase().includes(q)));
    }
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    return c.json(list);
  });

  app.post("/", async (c) => {
    const body = await c.req.json().catch(() => null) ?? {};
    const title = toStr(body.title).trim();
    const customerId = toStr(body.customerId);
    const type = toStr(body.type);
    const category = toStr(body.category);
    if (!title) return c.json({ error: "案件标题不能为空" }, 400);
    if (!customerId) return c.json({ error: "请选择客户" }, 400);
    if (!isCaseType(type)) return c.json({ error: "案件类型不合法" }, 400);
    if (!isValidCaseCategory(type, category)) return c.json({ error: "案件子类不合法" }, 400);
    if (!(await db.getCustomer(customerId))) return c.json({ error: "客户不存在" }, 400);
    const t = now();
    const cse: Case = {
      id: newId(),
      customerId,
      type: type as Case["type"],
      category,
      title,
      appNo: toStr(body.appNo),
      applyDate: toStr(body.applyDate),
      status: isCaseStatus(body.status) ? (body.status as Case["status"]) : "active",
      stage: toStr(body.stage) || category,
      note: toStr(body.note),
      createdAt: t,
      updatedAt: t,
    };
    await db.setCase(cse);
    await writeLog(db, c.get("username"), "案件", "新增", `${cse.title}（${cse.category}）`);
    return c.json(cse, 201);
  });

  app.get("/:id", async (c) => {
    const cse = await db.getCase(c.req.param("id"));
    if (!cse) return c.json({ error: "案件不存在" }, 404);
    return c.json(cse);
  });

  app.put("/:id", async (c) => {
    const cse = await db.getCase(c.req.param("id"));
    if (!cse) return c.json({ error: "案件不存在" }, 404);
    const body = await c.req.json().catch(() => null) ?? {};
    const next: Case = {
      ...cse,
      title: body.title !== undefined ? toStr(body.title).trim() : cse.title,
      appNo: body.appNo !== undefined ? toStr(body.appNo) : cse.appNo,
      applyDate: body.applyDate !== undefined ? toStr(body.applyDate) : cse.applyDate,
      status: body.status !== undefined
        ? isCaseStatus(body.status) ? body.status : cse.status
        : cse.status,
      stage: body.stage !== undefined ? toStr(body.stage) : cse.stage,
      note: body.note !== undefined ? toStr(body.note) : cse.note,
      updatedAt: now(),
    };
    if (!next.title) return c.json({ error: "案件标题不能为空" }, 400);
    await db.setCase(next);
    await writeLog(db, c.get("username"), "案件", "修改", next.title);
    return c.json(next);
  });

  app.delete("/:id", async (c) => {
    const cse = await db.getCase(c.req.param("id"));
    if (!cse) return c.json({ error: "案件不存在" }, 404);
    await db.deleteCaseCascade(cse.id);
    await writeLog(db, c.get("username"), "案件", "删除", `${cse.title}（含节点/费用/期限）`);
    return c.json({ ok: true });
  });

  // ---- 节点 ----
  app.get("/:id/activities", async (c) => {
    const cse = await db.getCase(c.req.param("id"));
    if (!cse) return c.json({ error: "案件不存在" }, 404);
    const list = await db.listActivities(cse.id);
    list.sort((a, b) => b.createdAt - a.createdAt);
    return c.json(list);
  });

  app.post("/:id/activities", async (c) => {
    const cse = await db.getCase(c.req.param("id"));
    if (!cse) return c.json({ error: "案件不存在" }, 404);
    const body = await c.req.json().catch(() => null) ?? {};
    const content = toStr(body.content).trim();
    if (!content) return c.json({ error: "节点内容不能为空" }, 400);
    const activity: CaseActivity = {
      id: newId(),
      caseId: cse.id,
      stage: toStr(body.stage) || cse.category,
      content,
      type: toStr(body.type) || "备注",
      createdAt: now(),
    };
    await db.setActivity(activity);
    await db.setCase({ ...cse, stage: activity.stage, updatedAt: now() }); // MDD-DATA-001 同步 stage
    await writeLog(db, c.get("username"), "节点", "新增", `${cse.title} → ${activity.stage}`);
    return c.json(activity, 201);
  });

  return app;
}
