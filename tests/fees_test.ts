// 费用 + 收款测试（TDD-TEST-015..020）
import { assertEquals } from "jsr:@std/assert@^1";
import { makeApp, authed } from "./helper.ts";

async function setupCase(headers: Record<string, string>) {
  const t = await makeApp();
  const { headers: h } = await authed(t);
  const cus = await (await t.app.request("/api/customers", {
    method: "POST", headers: h, body: JSON.stringify({ name: "客户H" }),
  })).json();
  const cse = await (await t.app.request("/api/cases", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ customerId: cus.id, type: "trademark", category: "注册申请", title: "案" }),
  })).json();
  return { t, headers: h, cse };
}

Deno.test("TEST-015 创建费用返回 201 且派生字段正确", async () => {
  const { t, headers, cse } = await setupCase({});
  const res = await t.app.request(`/api/cases/${cse.id}/fees`, {
    method: "POST",
    headers,
    body: JSON.stringify({ kind: "official" }),
  });
  assertEquals(res.status, 201);
  const fee = await res.json();
  assertEquals(fee.received, 0);
  assertEquals(fee.status, "unpaid");
});

Deno.test("TEST-016 非法金额返回 400", async () => {
  const { t, headers, cse } = await setupCase({});
  const res = await t.app.request(`/api/cases/${cse.id}/fees`, {
    method: "POST",
    headers,
    body: JSON.stringify({ kind: "official", amount: -1 }),
  });
  assertEquals(res.status, 400);
});

Deno.test("TEST-017 登记收款联动状态（partial → paid）", async () => {
  const { t, headers, cse } = await setupCase({});
  const fee = await (await t.app.request(`/api/cases/${cse.id}/fees`, {
    method: "POST",
    headers,
    body: JSON.stringify({ kind: "official", name: "申请官费", amount: 10000 }), // 100 元
  })).json();
  // 到账 30 元 → partial
  const p1 = await t.app.request(`/api/fees/${fee.id}/payments`, {
    method: "POST",
    headers,
    body: JSON.stringify({ date: "2026-08-01", amount: 3000 }),
  });
  const fee1 = await p1.json();
  assertEquals(p1.status, 201);
  assertEquals(fee1.received, 3000);
  assertEquals(fee1.status, "partial");
  // 再收 40 元（累计 70 元）→ 仍为 partial
  await t.app.request(`/api/fees/${fee.id}/payments`, {
    method: "POST",
    headers,
    body: JSON.stringify({ date: "2026-08-02", amount: 4000 }),
  });
  const feeMid = await (await t.app.request(`/api/cases/${cse.id}/fees`, { headers })).json();
  assertEquals(feeMid[0].received, 7000);
  assertEquals(feeMid[0].status, "partial");
  // 再收 30 元（累计 100 元）→ paid
  await t.app.request(`/api/fees/${fee.id}/payments`, {
    method: "POST",
    headers,
    body: JSON.stringify({ date: "2026-08-03", amount: 3000 }),
  });
  const fee2 = await (await t.app.request(`/api/cases/${cse.id}/fees`, { headers })).json();
  assertEquals(fee2[0].received, 10000);
  assertEquals(fee2[0].status, "paid");
});

Deno.test("TEST-018 删除最后一笔到账后状态回退", async () => {
  const { t, headers, cse } = await setupCase({});
  const fee = await (await t.app.request(`/api/cases/${cse.id}/fees`, {
    method: "POST",
    headers,
    body: JSON.stringify({ kind: "agency", name: "代理费", amount: 5000 }),
  })).json();
  const pay = await (await t.app.request(`/api/fees/${fee.id}/payments`, {
    method: "POST",
    headers,
    body: JSON.stringify({ date: "2026-08-01", amount: 5000 }),
  })).json();
  const pid = pay.payments[0].id;
  const del = await t.app.request(`/api/fees/${fee.id}/payments/${pid}`, { method: "DELETE", headers });
  assertEquals(del.status, 200);
  const after = await (await t.app.request(`/api/cases/${cse.id}/fees`, { headers })).json();
  assertEquals(after[0].received, 0);
  assertEquals(after[0].status, "unpaid");
});

Deno.test("TEST-019 删除费用后列表为空", async () => {
  const { t, headers, cse } = await setupCase({});
  const fee = await (await t.app.request(`/api/cases/${cse.id}/fees`, {
    method: "POST",
    headers,
    body: JSON.stringify({ kind: "official", amount: 1000 }),
  })).json();
  const del = await t.app.request(`/api/fees/${fee.id}`, { method: "DELETE", headers });
  assertEquals(del.status, 200);
  const list = await (await t.app.request(`/api/cases/${cse.id}/fees`, { headers })).json();
  assertEquals(list.length, 0);
});

Deno.test("TEST-020 费用不存在返回 404", async () => {
  const t = await makeApp();
  const { headers } = await authed(t);
  const id = "no-such-fee";
  assertEquals((await t.app.request(`/api/fees/${id}`, { method: "PUT", headers, body: "{}" })).status, 404);
  assertEquals((await t.app.request(`/api/fees/${id}`, { method: "DELETE", headers })).status, 404);
});
