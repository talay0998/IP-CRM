// 费用 + 收款路由（MDD-MOD-003）
import { Hono, type Context } from "hono";
import type { Db } from "../db.ts";
import type { Fee, Payment } from "../types.ts";
import {
  FEE_KINDS,
  feeReceived,
  feeStatus,
  isValidPositiveAmount,
  newId,
  now,
  toStr,
  todayStr,
} from "../types.ts";
import type { Vars } from "../auth.ts";
import { writeLog } from "../log.ts";

/** 附加派生字段 received / status（MDD-DATA-002） */
function withDerived(fee: Fee) {
  return { ...fee, received: feeReceived(fee), status: feeStatus(fee) };
}

function isFeeKind(v: unknown): boolean {
  return typeof v === "string" && (FEE_KINDS as readonly string[]).includes(v);
}

/** 挂 /api/cases：GET/POST /:id/fees */
export function createCaseFeesRoutes(db: Db) {
  const app = new Hono<{ Variables: Vars }>();

  app.get("/:id/fees", async (c) => {
    const cse = await db.getCase(c.req.param("id"));
    if (!cse) return c.json({ error: "案件不存在" }, 404);
    const list = await db.listFees(cse.id);
    list.sort((a, b) => b.createdAt - a.createdAt);
    return c.json(list.map(withDerived));
  });

  app.post("/:id/fees", async (c) => {
    const cse = await db.getCase(c.req.param("id"));
    if (!cse) return c.json({ error: "案件不存在" }, 404);
    const body = await c.req.json().catch(() => null) ?? {};
    const kind = toStr(body.kind);
    if (!isFeeKind(kind)) return c.json({ error: "费用类型不合法" }, 400);
    const amount = body.amount === undefined ? 0 : body.amount;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
      return c.json({ error: "金额不合法" }, 400);
    }
    const t = now();
    const fee: Fee = {
      id: newId(),
      caseId: cse.id,
      name: toStr(body.name).trim() || "费用",
      kind: kind as Fee["kind"],
      amount,
      dueDate: toStr(body.dueDate),
      note: toStr(body.note),
      payments: [],
      createdAt: t,
      updatedAt: t,
    };
    await db.setFee(fee);
    await writeLog(db, c.get("username"), "费用", "新增", `${fee.name}（${(fee.amount / 100).toFixed(2)} 元）`);
    return c.json(withDerived(fee), 201);
  });

  return app;
}

/** 挂 /api/fees：/:feeId PUT/DELETE + payments */
export function createFeesRoutes(db: Db) {
  const app = new Hono<{ Variables: Vars }>();

  async function loadFee(c: Context): Promise<Fee | null> {
    return await db.getFee(c.req.param("feeId") ?? "");
  }

  app.put("/:feeId", async (c) => {
    const fee = await loadFee(c);
    if (!fee) return c.json({ error: "费用不存在" }, 404);
    const body = await c.req.json().catch(() => null) ?? {};
    const amount = body.amount === undefined ? fee.amount : body.amount;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
      return c.json({ error: "金额不合法" }, 400);
    }
    if (body.kind !== undefined && !isFeeKind(body.kind)) {
      return c.json({ error: "费用类型不合法" }, 400);
    }
    const next: Fee = {
      ...fee,
      name: body.name !== undefined ? toStr(body.name).trim() : fee.name,
      kind: body.kind !== undefined ? body.kind : fee.kind,
      amount,
      dueDate: body.dueDate !== undefined ? toStr(body.dueDate) : fee.dueDate,
      note: body.note !== undefined ? toStr(body.note) : fee.note,
      updatedAt: now(),
    };
    await db.setFee(next);
    await writeLog(db, c.get("username"), "费用", "修改", next.name);
    return c.json(withDerived(next));
  });

  app.delete("/:feeId", async (c) => {
    const fee = await loadFee(c);
    if (!fee) return c.json({ error: "费用不存在" }, 404);
    await db.deleteFee(fee);
    await writeLog(db, c.get("username"), "费用", "删除", fee.name);
    return c.json({ ok: true });
  });

  app.post("/:feeId/payments", async (c) => {
    const fee = await loadFee(c);
    if (!fee) return c.json({ error: "费用不存在" }, 404);
    const body = await c.req.json().catch(() => null) ?? {};
    const amount = body.amount;
    if (!isValidPositiveAmount(amount)) return c.json({ error: "收款金额必须大于 0" }, 400);
    const payment: Payment = {
      id: newId(),
      date: toStr(body.date) || todayStr(),
      amount,
      note: toStr(body.note),
      createdAt: now(),
    };
    const next: Fee = { ...fee, payments: [...fee.payments, payment], updatedAt: now() };
    await db.setFee(next);
    await writeLog(db, c.get("username"), "收款", "新增", `${fee.name} 收款 ${(payment.amount / 100).toFixed(2)} 元`);
    return c.json(withDerived(next), 201);
  });

  app.delete("/:feeId/payments/:pid", async (c) => {
    const fee = await loadFee(c);
    if (!fee) return c.json({ error: "费用不存在" }, 404);
    const pid = c.req.param("pid");
    if (!fee.payments.some((p) => p.id === pid)) return c.json({ error: "收款记录不存在" }, 404);
    const next: Fee = { ...fee, payments: fee.payments.filter((p) => p.id !== pid), updatedAt: now() };
    await db.setFee(next);
    await writeLog(db, c.get("username"), "收款", "删除", fee.name);
    return c.json({ ok: true });
  });

  return app;
}
