// 期限测试（TDD-TEST-021..024）
import { assertEquals } from "jsr:@std/assert@^1";
import { addDaysStr, todayStr } from "../src/types.ts";
import { makeApp, authed } from "./helper.ts";

async function setupCase(headers: Record<string, string>) {
  const t = await makeApp();
  const { headers: h } = await authed(t);
  const cus = await (await t.app.request("/api/customers", {
    method: "POST", headers: h, body: JSON.stringify({ name: "客户I" }),
  })).json();
  const cse = await (await t.app.request("/api/cases", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ customerId: cus.id, type: "trademark", category: "续展", title: "续展案" }),
  })).json();
  return { t, headers: h, cse };
}

Deno.test("TEST-021 缺 dueDate 返回 400，合法则 201", async () => {
  const { t, headers, cse } = await setupCase({});
  const bad = await t.app.request("/api/deadlines", {
    method: "POST",
    headers,
    body: JSON.stringify({ caseId: cse.id, title: "续展到期", type: "renewal" }),
  });
  assertEquals(bad.status, 400);
  const ok = await t.app.request("/api/deadlines", {
    method: "POST",
    headers,
    body: JSON.stringify({ caseId: cse.id, title: "续展到期", type: "renewal", dueDate: addDaysStr(todayStr(), 20) }),
  });
  assertEquals(ok.status, 201);
  assertEquals((await ok.json()).caseTitle, "续展案");
});

Deno.test("TEST-022 upcoming 过滤只含指定天数内的期限", async () => {
  const { t, headers, cse } = await setupCase({});
  const mk = (title: string, dueDate: string) =>
    t.app.request("/api/deadlines", {
      method: "POST",
      headers,
      body: JSON.stringify({ caseId: cse.id, title, type: "fee", dueDate }),
    });
  await mk("30天内到期", addDaysStr(todayStr(), 10));
  await mk("90天后到期", addDaysStr(todayStr(), 90));
  const res = await t.app.request("/api/deadlines?upcoming=30", { headers });
  const list = await res.json();
  assertEquals(res.status, 200);
  assertEquals(list.length, 1);
  assertEquals(list[0].title, "30天内到期");
});

Deno.test("TEST-023 逾期派生 overdue=true", async () => {
  const { t, headers, cse } = await setupCase({});
  await t.app.request("/api/deadlines", {
    method: "POST",
    headers,
    body: JSON.stringify({ caseId: cse.id, title: "已逾期", type: "official_reply", dueDate: addDaysStr(todayStr(), -1) }),
  });
  const list = await (await t.app.request("/api/deadlines", { headers })).json();
  assertEquals(list[0].overdue, true);
  assertEquals(list[0].status, "pending");
});

Deno.test("TEST-024 toggle 完成状态切换", async () => {
  const { t, headers, cse } = await setupCase({});
  const d = await (await t.app.request("/api/deadlines", {
    method: "POST",
    headers,
    body: JSON.stringify({ caseId: cse.id, title: "答复", type: "official_reply", dueDate: addDaysStr(todayStr(), 15) }),
  })).json();
  const toggled = await (await t.app.request(`/api/deadlines/${d.id}/toggle`, { method: "POST", headers })).json();
  assertEquals(toggled.status, "done");
  const again = await (await t.app.request(`/api/deadlines/${d.id}/toggle`, { method: "POST", headers })).json();
  assertEquals(again.status, "pending");
});
