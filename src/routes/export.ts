// CSV 导出路由（分模块，中文表头）
import { Hono } from "hono";
import type { Db } from "../db.ts";
import type { Vars } from "../auth.ts";
import { writeLog } from "../log.ts";
import { CUSTOMER_KIND_LABEL, CASE_TYPE_LABEL, LEAD_STATUS_LABEL, LEAD_SOURCE_LABEL } from "../types.ts";

const MODULES = ["customers", "cases", "activities", "fees", "deadlines", "leads"] as const;
type Module = (typeof MODULES)[number];

function esc(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(headers: string[], rows: (string | number)[][]): string {
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

function fen(v: number): string {
  return (v / 100).toFixed(2);
}

export function createExportRoutes(db: Db) {
  const app = new Hono<{ Variables: Vars }>();

  app.get("/:module", async (c) => {
    const mod = c.req.param("module") as Module;
    if (!(MODULES as readonly string[]).includes(mod)) {
      return c.json({ error: "不支持的导出模块" }, 400);
    }

    const customers = await db.listCustomers();
    const cases = await db.listCases();
    const customerMap = new Map(customers.map((x) => [x.id, x]));
    const caseMap = new Map(cases.map((x) => [x.id, x]));

    let content = "";
    switch (mod) {
      case "customers": {
        content = csv(
          ["姓名", "主体类型", "公司全称", "证照号", "注册地址", "联系电话", "邮箱", "经办人", "经办人电话", "经办人邮箱", "备注", "创建时间", "更新时间"],
          customers.map((x) => [
            x.name, CUSTOMER_KIND_LABEL[x.kind] ?? "公司", x.company, x.idNo, x.address, x.phone, x.email,
            x.contactName, x.contactPhone, x.contactEmail, x.note,
            new Date(x.createdAt).toLocaleString(), new Date(x.updatedAt).toLocaleString(),
          ]),
        );
        break;
      }
      case "cases": {
        content = csv(
          ["客户", "案件类型", "子类", "标题", "申请号", "申请日期", "状态", "当前阶段", "备注", "更新时间"],
          cases.map((x) => [
            customerMap.get(x.customerId)?.name ?? x.customerId,
            CASE_TYPE_LABEL[x.type as keyof typeof CASE_TYPE_LABEL] ?? x.type,
            x.category, x.title, x.appNo, x.applyDate,
            x.status === "active" ? "进行中" : x.status === "completed" ? "已完成" : "已终止",
            x.stage, x.note, new Date(x.updatedAt).toLocaleString(),
          ]),
        );
        break;
      }
      case "activities": {
        const activities = await db.listActivitiesAll();
        content = csv(
          ["案件", "阶段", "节点内容", "类型", "创建时间"],
          activities.map((x) => [
            caseMap.get(x.caseId)?.title ?? x.caseId,
            x.stage, x.content, x.type, new Date(x.createdAt).toLocaleString(),
          ]),
        );
        break;
      }
      case "fees": {
        const fees = await db.listFeesAll();
        content = csv(
          ["案件", "费用名称", "类型", "应收金额", "已收金额", "状态", "截止日期", "备注"],
          fees.map((x) => {
            const received = x.payments.reduce((s, p) => s + p.amount, 0);
            const status = received <= 0 ? "未收款" : received >= x.amount ? "已收款" : "部分收款";
            return [
              caseMap.get(x.caseId)?.title ?? x.caseId,
              x.name, x.kind, fen(x.amount), fen(received), status, x.dueDate, x.note,
            ];
          }),
        );
        break;
      }
      case "deadlines": {
        const deadlines = await db.listDeadlines();
        content = csv(
          ["案件", "标题", "类型", "截止日期", "状态", "备注"],
          deadlines.map((x) => [
            caseMap.get(x.caseId)?.title ?? x.caseId,
            x.title, x.type, x.dueDate,
            x.status === "pending" ? "待处理" : "已完成",
            x.note,
          ]),
        );
        break;
      }
      case "leads": {
        const leads = await db.listLeads();
        content = csv(
          ["名称", "电话", "邮箱", "公司", "来源", "状态", "意向业务", "意向说明", "预计金额(元)", "关联客户", "备注", "更新时间"],
          leads.map((x) => [
            x.name, x.phone, x.email, x.company,
            LEAD_SOURCE_LABEL[x.source as keyof typeof LEAD_SOURCE_LABEL] ?? x.source,
            LEAD_STATUS_LABEL[x.status as keyof typeof LEAD_STATUS_LABEL] ?? x.status,
            CASE_TYPE_LABEL[x.businessType as keyof typeof CASE_TYPE_LABEL] ?? x.businessType,
            x.intention, fen(x.amount),
            customerMap.get(x.customerId)?.name ?? "",
            x.note, new Date(x.updatedAt).toLocaleString(),
          ]),
        );
        break;
      }
    }

    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="${mod}-${stamp()}.csv"`);
    await writeLog(db, c.get("username"), "系统", "导出", `导出 ${mod} CSV`);
    return c.body(`\ufeff${content}`, 200);
  });

  return app;
}
