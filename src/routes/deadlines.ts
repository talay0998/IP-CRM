// 期限路由（MDD-MOD-003）
import { Hono } from "hono";
import type { Db } from "../db.ts";
import type { Deadline } from "../types.ts";
import {
  DEADLINE_STATUSES,
  DEADLINE_TYPES,
  addDaysStr,
  isValidDate,
  newId,
  now,
  toStr,
  todayStr,
} from "../types.ts";
import type { Vars } from "../auth.ts";
import { writeLog } from "../log.ts";

function isDeadlineType(v: unknown): boolean {
  return typeof v === "string" && (DEADLINE_TYPES as readonly string[]).includes(v);
}
function isDeadlineStatus(v: unknown): boolean {
  return typeof v === "string" && (DEADLINE_STATUSES as readonly string[]).includes(v);
}

/** 附 join 与 overdue 派生（MDD-DATA-003） */
async function withView(db: Db, d: Deadline) {
  const cse = await db.getCase(d.caseId);
  const customer = cse ? await db.getCustomer(cse.customerId) : null;
  return {
    ...d,
    caseTitle: cse?.title ?? "",
    customerName: customer?.name ?? "",
    overdue: d.dueDate < todayStr() && d.status === "pending",
  };
}

export function createDeadlinesRoutes(db: Db) {
  const app = new Hono<{ Variables: Vars }>();

  app.get("/", async (c) => {
    const upcomingRaw = c.req.query("upcoming");
    const upcoming = upcomingRaw === undefined ? null : Number(upcomingRaw);
    const limit = Number.isFinite(upcoming) && (upcoming ?? 0) >= 0 ? upcoming! : null;
    let list = await db.listDeadlines();
    if (limit !== null) {
      const cutoff = addDaysStr(todayStr(), limit);
      list = list.filter((d) => d.dueDate <= cutoff && d.status === "pending");
    }
    list.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : b.updatedAt - a.updatedAt));
    return c.json(await Promise.all(list.map((d) => withView(db, d))));
  });

  app.post("/", async (c) => {
    const body = await c.req.json().catch(() => null) ?? {};
    const title = toStr(body.title).trim();
    const dueDate = toStr(body.dueDate);
    const caseId = toStr(body.caseId);
    if (!title) return c.json({ error: "期限标题不能为空" }, 400);
    if (!dueDate) return c.json({ error: "到期日期不能为空" }, 400);
    if (!isValidDate(dueDate)) return c.json({ error: "到期日期格式不合法" }, 400);
    if (!isDeadlineType(body.type)) return c.json({ error: "期限类型不合法" }, 400);
    if (!(await db.getCase(caseId))) return c.json({ error: "案件不存在" }, 400);
    const t = now();
    const deadline: Deadline = {
      id: newId(),
      caseId,
      title,
      type: body.type as Deadline["type"],
      dueDate,
      status: isDeadlineStatus(body.status) ? (body.status as Deadline["status"]) : "pending",
      note: toStr(body.note),
      createdAt: t,
      updatedAt: t,
    };
    await db.setDeadline(deadline);
    await writeLog(db, c.get("username"), "期限", "新增", `${deadline.title}（${deadline.dueDate}）`);
    return c.json(await withView(db, deadline), 201);
  });

  app.put("/:id", async (c) => {
    const d = await db.getDeadline(c.req.param("id"));
    if (!d) return c.json({ error: "期限不存在" }, 404);
    const body = await c.req.json().catch(() => null) ?? {};
    const next: Deadline = {
      ...d,
      title: body.title !== undefined ? toStr(body.title).trim() : d.title,
      dueDate: body.dueDate !== undefined ? toStr(body.dueDate) : d.dueDate,
      status: body.status !== undefined
        ? isDeadlineStatus(body.status) ? body.status : d.status
        : d.status,
      note: body.note !== undefined ? toStr(body.note) : d.note,
      updatedAt: now(),
    };
    if (!next.title) return c.json({ error: "期限标题不能为空" }, 400);
    if (!next.dueDate) return c.json({ error: "到期日期不能为空" }, 400);
    if (body.type !== undefined && !isDeadlineType(body.type)) return c.json({ error: "期限类型不合法" }, 400);
    await db.setDeadline(next);
    await writeLog(db, c.get("username"), "期限", "修改", next.title);
    return c.json(await withView(db, next));
  });

  app.delete("/:id", async (c) => {
    const d = await db.getDeadline(c.req.param("id"));
    if (!d) return c.json({ error: "期限不存在" }, 404);
    await db.deleteDeadline(d.id);
    await writeLog(db, c.get("username"), "期限", "删除", d.title);
    return c.json({ ok: true });
  });

  app.post("/:id/toggle", async (c) => {
    const d = await db.getDeadline(c.req.param("id"));
    if (!d) return c.json({ error: "期限不存在" }, 404);
    const next: Deadline = {
      ...d,
      status: d.status === "pending" ? "done" : "pending",
      updatedAt: now(),
    };
    await db.setDeadline(next);
    await writeLog(db, c.get("username"), "期限", next.status === "done" ? "完成" : "重开", d.title);
    return c.json(await withView(db, next));
  });

  return app;
}
