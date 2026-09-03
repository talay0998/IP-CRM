// 客户路由（MDD-MOD-003 / MDD-API-001）
import { Hono } from "hono";
import type { Db } from "../db.ts";
import type { Customer, CustomerKind } from "../types.ts";
import { CUSTOMER_KINDS, newId, now, toStr } from "../types.ts";

function pickKind(v: unknown, fallback: CustomerKind): CustomerKind {
  const s = toStr(v);
  return (CUSTOMER_KINDS as readonly string[]).includes(s) ? s as CustomerKind : fallback;
}
import type { Vars } from "../auth.ts";
import { writeLog } from "../log.ts";

export function createCustomersRoutes(db: Db) {
  const app = new Hono<{ Variables: Vars }>();

  app.get("/", async (c) => {
    const q = (c.req.query("q") ?? "").trim().toLowerCase();
    let list = await db.listCustomers();
    if (q) {
      list = list.filter((x) =>
        [x.name, x.company, x.phone, x.email, x.contactName, x.contactPhone, x.contactEmail, x.idNo]
          .some((f) => f.toLowerCase().includes(q))
      );
    }
    const kind = c.req.query("kind");
    if (kind && (CUSTOMER_KINDS as readonly string[]).includes(kind)) {
      list = list.filter((x) => x.kind === kind);
    }
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    return c.json(list);
  });

  app.post("/", async (c) => {
    const body = await c.req.json().catch(() => null) ?? {};
    const name = toStr(body.name).trim();
    if (!name) return c.json({ error: "姓名不能为空" }, 400);
    const t = now();
    const customer: Customer = {
      id: newId(),
      name,
      kind: pickKind(body.kind, "company"),
      company: toStr(body.company),
      idNo: toStr(body.idNo),
      address: toStr(body.address),
      phone: toStr(body.phone),
      email: toStr(body.email),
      contactName: toStr(body.contactName),
      contactPhone: toStr(body.contactPhone),
      contactEmail: toStr(body.contactEmail),
      note: toStr(body.note),
      createdAt: t,
      updatedAt: t,
    };
    await db.setCustomer(customer);
    await writeLog(db, c.get("username"), "客户", "新增", customer.name);
    return c.json(customer, 201);
  });

  app.get("/:id", async (c) => {
    const customer = await db.getCustomer(c.req.param("id"));
    if (!customer) return c.json({ error: "客户不存在" }, 404);
    return c.json(customer);
  });

  app.put("/:id", async (c) => {
    const customer = await db.getCustomer(c.req.param("id"));
    if (!customer) return c.json({ error: "客户不存在" }, 404);
    const body = await c.req.json().catch(() => null) ?? {};
    const next: Customer = {
      ...customer,
      name: body.name !== undefined ? toStr(body.name).trim() : customer.name,
      kind: body.kind !== undefined ? pickKind(body.kind, customer.kind) : customer.kind,
      company: body.company !== undefined ? toStr(body.company) : customer.company,
      idNo: body.idNo !== undefined ? toStr(body.idNo) : customer.idNo,
      address: body.address !== undefined ? toStr(body.address) : customer.address,
      phone: body.phone !== undefined ? toStr(body.phone) : customer.phone,
      email: body.email !== undefined ? toStr(body.email) : customer.email,
      contactName: body.contactName !== undefined ? toStr(body.contactName) : customer.contactName,
      contactPhone: body.contactPhone !== undefined ? toStr(body.contactPhone) : customer.contactPhone,
      contactEmail: body.contactEmail !== undefined ? toStr(body.contactEmail) : customer.contactEmail,
      note: body.note !== undefined ? toStr(body.note) : customer.note,
      updatedAt: now(),
    };
    if (!next.name) return c.json({ error: "姓名不能为空" }, 400);
    await db.setCustomer(next);
    await writeLog(db, c.get("username"), "客户", "修改", next.name);
    return c.json(next);
  });

  app.delete("/:id", async (c) => {
    const customer = await db.getCustomer(c.req.param("id"));
    if (!customer) return c.json({ error: "客户不存在" }, 404);
    const deletedCases = await db.deleteCustomerCascade(customer.id);
    await writeLog(db, c.get("username"), "客户", "删除", `${customer.name}（级联 ${deletedCases} 个案件）`);
    return c.json({ ok: true, deletedCases });
  });

  return app;
}
