// 看板统计测试（TDD-TEST-025）
import { assertEquals } from "jsr:@std/assert@^1";
import { addDaysStr, todayStr } from "../src/types.ts";
import { makeApp, authed } from "./helper.ts";

Deno.test("TEST-025 看板统计正确", async () => {
  const t = await makeApp();
  const { headers } = await authed(t);
  const cus = await (await t.app.request("/api/customers", {
    method: "POST", headers, body: JSON.stringify({ name: "客户J" }),
  })).json();
  const mkCase = (title: string, type: string, category: string, status = "active") =>
    t.app.request("/api/cases", {
      method: "POST",
      headers,
      body: JSON.stringify({ customerId: cus.id, type, category, title, status }),
    });
  const c1 = await (await mkCase("商标甲", "trademark", "注册申请")).json();
  const c2 = await (await mkCase("商标乙", "trademark", "异议")).json();
  const c3 = await (await mkCase("作品丙", "copyright", "作品登记")).json();
  await mkCase("已完案", "trademark", "注册申请", "completed");

  // 费用：100 元 + 50 元，其中 100 元收 30 → received 3000
  const f1 = await (await t.app.request(`/api/cases/${c1.id}/fees`, {
    method: "POST", headers, body: JSON.stringify({ kind: "official", amount: 10000 }),
  })).json();
  await t.app.request(`/api/fees/${f1.id}/payments`, {
    method: "POST", headers, body: JSON.stringify({ amount: 3000, date: todayStr() }),
  });
  await t.app.request(`/api/cases/${c2.id}/fees`, {
    method: "POST", headers, body: JSON.stringify({ kind: "agency", amount: 5000 }),
  });

  // 期限：一条 10 天内 pending，一条已 done
  await t.app.request("/api/deadlines", {
    method: "POST", headers,
    body: JSON.stringify({ caseId: c1.id, title: "近期", type: "renewal", dueDate: addDaysStr(todayStr(), 10) }),
  });
  await t.app.request("/api/deadlines", {
    method: "POST", headers,
    body: JSON.stringify({ caseId: c2.id, title: "已完成", type: "fee", dueDate: addDaysStr(todayStr(), 5), status: "done" }),
  });

  const dash = await (await t.app.request("/api/dashboard", { headers })).json();
  assertEquals(dash.caseCounts, {
    total: 4,
    byType: {
      "商标代理": 3,
      "版权代理": 1,
      "软件著作权": 0,
      "法律咨询": 0,
      "注册登记": 0,
      "软件开发": 0,
      "数据服务": 0,
    },
    active: 3,
    completed: 1,
    terminated: 0,
  });
  assertEquals(dash.feeTotals, { receivable: 15000, received: 3000, pending: 12000 });
  assertEquals(dash.upcomingDeadlines.length, 1);
  assertEquals(dash.upcomingDeadlines[0].title, "近期");
  assertEquals(dash.upcomingDeadlines[0].customerName, "客户J");
  assertEquals(dash.recentCases.length, 4);
  assertEquals(dash.activeLeads, 0);
});
