// 财务管理路由：全局费用列表 + 汇总
import { Hono } from "hono";
import type { Db } from "../db.ts";
import { feeReceived } from "../types.ts";
import type { Vars } from "../auth.ts";

export function createFinanceRoutes(db: Db) {
  const app = new Hono<{ Variables: Vars }>();

  app.get("/", async (c) => {
    const q = (c.req.query("q") ?? "").trim().toLowerCase();
    const status = c.req.query("status");
    const [fees, cases, customers] = await Promise.all([
      db.listFeesAll(),
      db.listCases(),
      db.listCustomers(),
    ]);
    const caseMap = new Map(cases.map((x) => [x.id, x]));
    const customerMap = new Map(customers.map((x) => [x.id, x]));

    const rows = fees.map((f) => {
      const cse = caseMap.get(f.caseId);
      const customer = cse ? customerMap.get(cse.customerId) : null;
      const received = feeReceived(f);
      const s = received <= 0 ? "unpaid" : received >= f.amount ? "paid" : "partial";
      return {
        ...f,
        caseTitle: cse?.title ?? "",
        customerName: customer?.name ?? "",
        received,
        status: s,
      };
    });

    let filtered = rows;
    if (status) filtered = filtered.filter((r) => r.status === status);
    if (q) {
      filtered = filtered.filter((r) =>
        [r.customerName, r.caseTitle, r.name].some((x) => x.toLowerCase().includes(q))
      );
    }
    filtered.sort((a, b) => b.updatedAt - a.updatedAt);

    const summary = filtered.reduce(
      (acc, r) => {
        acc.receivable += r.amount;
        acc.received += r.received;
        return acc;
      },
      { receivable: 0, received: 0, pending: 0 },
    );
    summary.pending = summary.receivable - summary.received;

    return c.json({ summary, rows: filtered });
  });

  return app;
}
