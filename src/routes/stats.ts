// 业务统计路由
import { Hono } from "hono";
import type { Db } from "../db.ts";
import { feeReceived, CASE_TYPES, CASE_TYPE_LABEL } from "../types.ts";
import type { Vars } from "../auth.ts";

export function createStatsRoutes(db: Db) {
  const app = new Hono<{ Variables: Vars }>();

  app.get("/", async (c) => {
    const [cases, fees, customers] = await Promise.all([
      db.listCases(),
      db.listFeesAll(),
      db.listCustomers(),
    ]);

    const customerMap = new Map(customers.map((x) => [x.id, x]));

    // 业务分布（按类型 + 状态）
    const byType: Record<string, number> = {};
    for (const t of CASE_TYPES) byType[t] = 0;
    const byStatus = { active: 0, completed: 0, terminated: 0 };
    for (const x of cases) {
      byType[x.type] = (byType[x.type] ?? 0) + 1;
      if (x.status === "active") byStatus.active++;
      else if (x.status === "completed") byStatus.completed++;
      else byStatus.terminated++;
    }
    const typeLabels: Record<string, string> = {};
    for (const t of CASE_TYPES) typeLabels[`${t}`] = CASE_TYPE_LABEL[t as keyof typeof CASE_TYPE_LABEL] ?? t;
    const caseDistribution = { byType, byStatus, typeLabels };

    // 最近 6 个月费用趋势（按费用创建月 / 收款月）
    const months: { key: string; label: string; receivable: number; received: number }[] = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 5; i >= 0; i--) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: `${m.getMonth() + 1} 月`, receivable: 0, received: 0 });
    }
    const monthOf = (ts: number) => {
      const x = new Date(ts);
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
    };
    for (const f of fees) {
      const mi = months.findIndex((m) => m.key === monthOf(f.createdAt));
      if (mi >= 0) months[mi].receivable += f.amount;
      for (const p of f.payments) {
        const mi2 = months.findIndex((m) => m.key === monthOf(new Date(p.date).getTime() || p.createdAt));
        if (mi2 >= 0) months[mi2].received += p.amount;
      }
    }

    // 客户费用排名
    const customerRows = new Map<string, { name: string; receivable: number; received: number; caseCount: number }>();
    for (const x of cases) {
      const row = customerRows.get(x.customerId) ?? { name: customerMap.get(x.customerId)?.name ?? "未知", receivable: 0, received: 0, caseCount: 0 };
      row.caseCount++;
      customerRows.set(x.customerId, row);
    }
    for (const f of fees) {
      const cse = cases.find((x) => x.id === f.caseId);
      if (!cse) continue;
      const row = customerRows.get(cse.customerId);
      if (!row) continue;
      row.receivable += f.amount;
      row.received += feeReceived(f);
    }
    const topCustomers = [...customerRows.values()].sort((a, b) => b.receivable - a.receivable).slice(0, 10);

    return c.json({ caseDistribution, feeTrend: months, topCustomers });
  });

  return app;
}
