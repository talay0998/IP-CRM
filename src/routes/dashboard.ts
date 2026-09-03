// 看板聚合路由（MDD-MOD-003）
import { Hono } from "hono";
import type { Db } from "../db.ts";
import { addDaysStr, feeReceived, todayStr, CASE_TYPE_LABEL } from "../types.ts";
import type { Vars } from "../auth.ts";

export function createDashboardRoutes(db: Db) {
  const app = new Hono<{ Variables: Vars }>();

  app.get("/", async (c) => {
    const [cases, fees, deadlines, customers, leads] = await Promise.all([
      db.listCases(),
      db.listFeesAll(),
      db.listDeadlines(),
      db.listCustomers(),
      db.listLeads(),
    ]);

    const typeCounts: Record<string, number> = {};
    for (const label of Object.values(CASE_TYPE_LABEL)) typeCounts[label] = 0;
    for (const x of cases) {
      const label = CASE_TYPE_LABEL[x.type as keyof typeof CASE_TYPE_LABEL] ?? x.type;
      typeCounts[label] = (typeCounts[label] ?? 0) + 1;
    }
    const caseCounts = {
      total: cases.length,
      byType: typeCounts,
      active: cases.filter((x) => x.status === "active").length,
      completed: cases.filter((x) => x.status === "completed").length,
      terminated: cases.filter((x) => x.status === "terminated").length,
    };

    const receivable = fees.reduce((s, f) => s + f.amount, 0);
    const received = fees.reduce((s, f) => s + feeReceived(f), 0);
    const feeTotals = { receivable, received, pending: receivable - received };

    const activeLeads = leads.filter((l) => ["new", "contacted", "qualified", "negotiating"].includes(l.status)).length;

    const today = todayStr();
    const cutoff = addDaysStr(today, 30);
    const customerMap = new Map(customers.map((x) => [x.id, x]));
    const caseMap = new Map(cases.map((x) => [x.id, x]));
    const upcomingDeadlines = deadlines
      .filter((d) => d.status === "pending" && (d.dueDate <= cutoff || d.dueDate < today))
      .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
      .map((d) => {
        const cse = caseMap.get(d.caseId);
        const customer = cse ? customerMap.get(cse.customerId) : null;
        return {
          ...d,
          caseTitle: cse?.title ?? "",
          customerName: customer?.name ?? "",
          overdue: d.dueDate < today,
        };
      });

    const recentCases = [...cases].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);

    return c.json({ caseCounts, feeTotals, upcomingDeadlines, recentCases, activeLeads });
  });

  return app;
}
