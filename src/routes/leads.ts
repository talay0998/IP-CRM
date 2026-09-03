// 销售线索路由：承接多种业务的获客与跟进，可转化为客户
import { Hono } from "hono";
import type { Db } from "../db.ts";
import type { Lead } from "../types.ts";
import {
  CASE_TYPES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  newId,
  now,
  toStr,
  isValidPositiveAmount,
} from "../types.ts";
import type { Vars } from "../auth.ts";
import { writeLog } from "../log.ts";
import type { Customer } from "../types.ts";

function isLeadStatus(v: unknown): boolean {
  return typeof v === "string" && (LEAD_STATUSES as readonly string[]).includes(v);
}
function isLeadSource(v: unknown): boolean {
  return typeof v === "string" && (LEAD_SOURCES as readonly string[]).includes(v);
}
function isCaseType(v: unknown): boolean {
  return typeof v === "string" && (CASE_TYPES as readonly string[]).includes(v);
}

export function createLeadsRoutes(db: Db) {
  const app = new Hono<{ Variables: Vars }>();

  app.get("/", async (c) => {
    const q = (c.req.query("q") ?? "").trim().toLowerCase();
    const status = c.req.query("status");
    let list = await db.listLeads();
    if (status) list = list.filter((x) => x.status === status);
    if (q) {
      list = list.filter((x) =>
        [x.name, x.company, x.phone, x.email, x.intention].some((f) => f.toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    return c.json(list);
  });

  app.post("/", async (c) => {
    const body = await c.req.json().catch(() => null) ?? {};
    const name = toStr(body.name).trim();
    if (!name) return c.json({ error: "线索名称不能为空" }, 400);
    const amount = body.amount === undefined ? 0 : body.amount;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
      return c.json({ error: "预计金额不合法" }, 400);
    }
    if (body.businessType !== undefined && !isCaseType(body.businessType)) {
      return c.json({ error: "意向业务类型不合法" }, 400);
    }
    if (body.status !== undefined && !isLeadStatus(body.status)) {
      return c.json({ error: "线索状态不合法" }, 400);
    }
    if (body.source !== undefined && !isLeadSource(body.source)) {
      return c.json({ error: "线索来源不合法" }, 400);
    }
    const t = now();
    const lead: Lead = {
      id: newId(),
      name,
      phone: toStr(body.phone),
      email: toStr(body.email),
      company: toStr(body.company),
      source: isLeadSource(body.source) ? (body.source as Lead["source"]) : "other",
      status: isLeadStatus(body.status) ? (body.status as Lead["status"]) : "new",
      businessType: toStr(body.businessType),
      intention: toStr(body.intention),
      amount,
      note: toStr(body.note),
      customerId: toStr(body.customerId),
      createdAt: t,
      updatedAt: t,
    };
    await db.setLead(lead);
    await writeLog(db, c.get("username"), "线索", "新增", lead.name);
    return c.json(lead, 201);
  });

  app.get("/:id", async (c) => {
    const lead = await db.getLead(c.req.param("id"));
    if (!lead) return c.json({ error: "线索不存在" }, 404);
    return c.json(lead);
  });

  app.put("/:id", async (c) => {
    const lead = await db.getLead(c.req.param("id"));
    if (!lead) return c.json({ error: "线索不存在" }, 404);
    const body = await c.req.json().catch(() => null) ?? {};
    const amount = body.amount === undefined ? lead.amount : body.amount;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
      return c.json({ error: "预计金额不合法" }, 400);
    }
    const next: Lead = {
      ...lead,
      name: body.name !== undefined ? toStr(body.name).trim() : lead.name,
      phone: body.phone !== undefined ? toStr(body.phone) : lead.phone,
      email: body.email !== undefined ? toStr(body.email) : lead.email,
      company: body.company !== undefined ? toStr(body.company) : lead.company,
      source: body.source !== undefined
        ? isLeadSource(body.source) ? body.source : lead.source
        : lead.source,
      status: body.status !== undefined
        ? isLeadStatus(body.status) ? body.status : lead.status
        : lead.status,
      businessType: body.businessType !== undefined
        ? isCaseType(body.businessType) ? body.businessType : lead.businessType
        : lead.businessType,
      intention: body.intention !== undefined ? toStr(body.intention) : lead.intention,
      amount,
      note: body.note !== undefined ? toStr(body.note) : lead.note,
      customerId: body.customerId !== undefined ? toStr(body.customerId) : lead.customerId,
      updatedAt: now(),
    };
    if (!next.name) return c.json({ error: "线索名称不能为空" }, 400);
    await db.setLead(next);
    await writeLog(db, c.get("username"), "线索", "修改", next.name);
    return c.json(next);
  });

  app.delete("/:id", async (c) => {
    const lead = await db.getLead(c.req.param("id"));
    if (!lead) return c.json({ error: "线索不存在" }, 404);
    await db.deleteLead(lead.id);
    await writeLog(db, c.get("username"), "线索", "删除", lead.name);
    return c.json({ ok: true });
  });

  // 转化为客户：用线索信息建档客户，线索状态置为 won 并回填 customerId
  app.post("/:id/convert", async (c) => {
    const lead = await db.getLead(c.req.param("id"));
    if (!lead) return c.json({ error: "线索不存在" }, 404);
    const body = await c.req.json().catch(() => null) ?? {};
    const existingCustomer = toStr(body.customerId);

    let customerId = existingCustomer;
    if (!customerId) {
      const kind = lead.company ? "company" : "individual";
      const t = now();
      const customer: Customer = {
        id: newId(),
        name: toStr(body.name).trim() || lead.name,
        kind,
        company: toStr(body.company).trim() || lead.company,
        idNo: toStr(body.idNo),
        address: toStr(body.address),
        phone: toStr(body.phone).trim() || lead.phone,
        email: toStr(body.email).trim() || lead.email,
        contactName: toStr(body.contactName),
        contactPhone: toStr(body.contactPhone),
        contactEmail: toStr(body.contactEmail),
        note: toStr(body.note),
        createdAt: t,
        updatedAt: t,
      };
      await db.setCustomer(customer);
      customerId = customer.id;
    } else {
      const existing = await db.getCustomer(existingCustomer);
      if (!existing) return c.json({ error: "关联客户不存在" }, 400);
    }

    const t = now();
    const updated: Lead = {
      ...lead,
      status: "won",
      customerId,
      updatedAt: t,
    };
    await db.setLead(updated);
    await writeLog(db, c.get("username"), "线索", "转化", `${lead.name} → 客户`);
    return c.json(updated);
  });

  return app;
}
