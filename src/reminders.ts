// 到期提醒：扫描待办期限，组装邮件内容并发送
import type { Db } from "./db.ts";
import type { SmtpMessage } from "./smtp.ts";
import { sendEmail } from "./smtp.ts";
import { DEADLINE_TYPE_LABEL, addDaysStr, todayStr } from "./types.ts";

/** 提前提醒天数 */
const REMIND_AHEAD_DAYS = 7;

export interface ReminderItem {
  id: string;
  title: string;
  type: string;
  typeLabel: string;
  dueDate: string;
  overdue: boolean;
  customerName: string;
  caseTitle: string;
}

/** 扫描待办期限（已逾期或 7 天内到期），组装邮件；无提醒项返回 email=null */
export async function buildReminderEmail(
  db: Db,
  to: string,
): Promise<{ items: ReminderItem[]; email: SmtpMessage | null }> {
  const today = todayStr();
  const horizon = addDaysStr(today, REMIND_AHEAD_DAYS);
  const [deadlines, cases, customers] = [
    await db.listDeadlines(),
    await db.listCases(),
    await db.listCustomers(),
  ];
  const caseById = new Map(cases.map((c) => [c.id, c]));
  const custById = new Map(customers.map((c) => [c.id, c]));

  const items: ReminderItem[] = deadlines
    .filter((d) => d.status === "pending" && d.dueDate <= horizon)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((d) => {
      const cs = caseById.get(d.caseId);
      const cust = cs ? custById.get(cs.customerId) : undefined;
      return {
        id: d.id,
        title: d.title,
        type: d.type,
        typeLabel: DEADLINE_TYPE_LABEL[d.type] ?? d.type,
        dueDate: d.dueDate,
        overdue: d.dueDate < today,
        customerName: cust?.name ?? "（未知客户）",
        caseTitle: cs?.title ?? "（未知案件）",
      };
    });

  if (items.length === 0) return { items, email: null };

  const lines = items.map(
    (it, i) =>
      `${i + 1}. 【${it.overdue ? "已逾期" : "将到期"}】${it.title}（${it.typeLabel}）\n` +
      `    客户：${it.customerName}｜案件：${it.caseTitle}\n` +
      `    截止：${it.dueDate}`,
  );
  const email: SmtpMessage = {
    to,
    subject: `【到期提醒】${items.length} 项期限即将到期或已逾期（${today}）`,
    body:
      `以下期限需要跟进：\n\n${lines.join("\n\n")}\n\n` +
      `---\n请登录系统处理，或联系经办人。`,
  };
  return { items, email };
}

/** 用已保存设置发送到期提醒；返回发送结果（用于手动触发与定时任务） */
export async function runReminder(
  db: Db,
): Promise<{ ok: boolean; message: string; count: number; to: string }> {
  const settings = await db.getSettings();
  const cfg = settings?.smtp;
  if (!cfg?.host) return { ok: false, message: "尚未配置 SMTP", count: 0, to: "" };
  const to = settings?.contact.email || Deno.env.get("REMINDER_TO") || "";
  if (!to) return { ok: false, message: "未配置收件邮箱", count: 0, to: "" };
  const { items, email } = await buildReminderEmail(db, to);
  if (email === null) return { ok: true, message: "当前没有需要提醒的期限", count: 0, to };
  const result = await sendEmail(cfg, email);
  return result.ok
    ? { ok: true, message: `已发送 ${items.length} 项到期提醒`, count: items.length, to }
    : { ok: false, message: result.message, count: 0, to };
}
