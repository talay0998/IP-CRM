// 级联删除测试（TDD-TEST-028 / ADD-COUP-001）
import { assertEquals } from "jsr:@std/assert@^1";
import { makeApp, authed, type TestApp } from "./helper.ts";

Deno.test("TEST-028 删除客户级联清除案件/节点/费用/期限", async () => {
  const t = await makeApp();
  const { headers } = await authed(t);
  const cus = await (await t.app.request("/api/customers", {
    method: "POST", headers, body: JSON.stringify({ name: "客户K" }),
  })).json();
  const mkCase = (title: string) =>
    t.app.request("/api/cases", {
      method: "POST",
      headers,
      body: JSON.stringify({ customerId: cus.id, type: "trademark", category: "注册申请", title }),
    });
  const c1 = await (await mkCase("案一")).json();
  const c2 = await (await mkCase("案二")).json();
  await t.app.request(`/api/cases/${c1.id}/activities`, {
    method: "POST", headers, body: JSON.stringify({ content: "节点记录" }),
  });
  await t.app.request(`/api/cases/${c1.id}/fees`, {
    method: "POST", headers, body: JSON.stringify({ kind: "official", amount: 1000 }),
  });
  await t.app.request("/api/deadlines", {
    method: "POST", headers,
    body: JSON.stringify({ caseId: c1.id, title: "期限", type: "fee", dueDate: "2026-12-31" }),
  });

  const del = await t.app.request(`/api/customers/${cus.id}`, { method: "DELETE", headers });
  assertEquals(del.status, 200);
  const body = await del.json();
  assertEquals(body.deletedCases, 2);

  // 直接查表确认无残留
  const leftovers = {
    customers: await rowCount(t, "customers"),
    cases: await rowCount(t, "cases"),
    activities: await rowCount(t, "activities"),
    fees: await rowCount(t, "fees"),
    deadlines: await rowCount(t, "deadlines"),
  };
  assertEquals(leftovers, { customers: 0, cases: 0, activities: 0, fees: 0, deadlines: 0 });
  t.close();
});

async function rowCount(t: TestApp, table: string): Promise<number> {
  const rs = await t.db.client.execute(`select count(*) as n from ${table}`);
  return Number((rs.rows[0] as unknown as Record<string, unknown>).n ?? 0);
}
