// 到期提醒测试：邮件内容组装（纯函数，不依赖 SMTP 网络）
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { makeApp } from "./helper.ts";
import type { TestApp } from "./helper.ts";
import { buildReminderEmail } from "../src/reminders.ts";
import { addDaysStr, todayStr } from "../src/types.ts";

async function setup(): Promise<TestApp> {
  const t = await makeApp();
  const cust = {
    id: "c1", name: "张三", kind: "company" as const, company: "A 公司", idNo: "", address: "",
    phone: "", email: "z@a.com", contactName: "", contactPhone: "", contactEmail: "", note: "",
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  const cs = {
    id: "k1", customerId: "c1", type: "trademark" as const, category: "注册申请", title: "商标注册 A",
    appNo: "", applyDate: "", status: "active" as const, stage: "注册申请", note: "",
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  await t.db.setCustomer(cust);
  await t.db.setCase(cs);
  const today = todayStr();
  const overdue = {
    id: "d1", caseId: "k1", title: "答复驳回通知", type: "official_reply" as const,
    dueDate: addDaysStr(today, -2), status: "pending" as const, note: "",
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  const soon = {
    id: "d2", caseId: "k1", title: "缴纳官费", type: "fee" as const,
    dueDate: addDaysStr(today, 3), status: "pending" as const, note: "",
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  const far = {
    id: "d3", caseId: "k1", title: "远期限", type: "renewal" as const,
    dueDate: addDaysStr(today, 30), status: "pending" as const, note: "",
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  await t.db.setDeadline(overdue);
  await t.db.setDeadline(soon);
  await t.db.setDeadline(far);
  return t;
}

Deno.test("REM-001 提醒扫描：逾期与 7 天内到期入选，远期限不入选", async () => {
  const t = await setup();
  const { items, email } = await buildReminderEmail(t.db, "admin@x.com");
  assertEquals(items.length, 2);
  assertEquals(items[0].id, "d1"); // 逾期优先
  assert(items[0].overdue);
  assertEquals(items[1].id, "d2");
  assert(!items[1].overdue);
  assertEquals(email!.to, "admin@x.com");
  assert(email!.subject.includes("2 项"));
  assert(email!.body.includes("张三"));
  assert(email!.body.includes("商标注册 A"));
  assert(email!.body.includes("已逾期"));
  t.close();
});

Deno.test("REM-002 无待办期限时 email 为 null", async () => {
  const t = await makeApp();
  const { items, email } = await buildReminderEmail(t.db, "a@b.c");
  assertEquals(items.length, 0);
  assertEquals(email, null);
  t.close();
});

Deno.test("REM-003 已完成的期限不提醒", async () => {
  const t = await setup();
  const [d1] = await t.db.listDeadlines();
  const done = { ...d1, status: "done" as const };
  await t.db.setDeadline(done);
  const { items } = await buildReminderEmail(t.db, "a@b.c");
  assert(!items.some((i) => i.id === d1.id));
  t.close();
});
