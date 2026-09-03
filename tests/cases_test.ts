// 案件 + 节点测试（TDD-TEST-006..014）
import { assertEquals } from "jsr:@std/assert@^1";
import { makeApp, authed } from "./helper.ts";

Deno.test("TEST-006 创建合法商标案件返回 201", async () => {
  const t = await makeApp();
  const { headers } = await authed(t);
  const cus = await (await t.app.request("/api/customers", {
    method: "POST", headers, body: JSON.stringify({ name: "客户A" }),
  })).json();
  const res = await t.app.request("/api/cases", {
    method: "POST",
    headers,
    body: JSON.stringify({ customerId: cus.id, type: "trademark", category: "注册申请", title: "某某商标" }),
  });
  assertEquals(res.status, 201);
  const cse = await res.json();
  assertEquals(cse.type, "trademark");
  assertEquals(cse.category, "注册申请");
  assertEquals(cse.status, "active");
});

Deno.test("TEST-007 非法子类组合返回 400", async () => {
  const t = await makeApp();
  const { headers } = await authed(t);
  const cus = await (await t.app.request("/api/customers", {
    method: "POST", headers, body: JSON.stringify({ name: "客户B" }),
  })).json();
  const res = await t.app.request("/api/cases", {
    method: "POST",
    headers,
    body: JSON.stringify({ customerId: cus.id, type: "copyright", category: "注册申请", title: "测试" }),
  });
  assertEquals(res.status, 400);
});

Deno.test("TEST-008 客户不存在时建案返回 400", async () => {
  const t = await makeApp();
  const { headers } = await authed(t);
  const res = await t.app.request("/api/cases", {
    method: "POST",
    headers,
    body: JSON.stringify({ customerId: "ghost", type: "trademark", category: "注册申请", title: "测试" }),
  });
  assertEquals(res.status, 400);
});

Deno.test("TEST-009 缺案件标题返回 400", async () => {
  const t = await makeApp();
  const { headers } = await authed(t);
  const cus = await (await t.app.request("/api/customers", {
    method: "POST", headers, body: JSON.stringify({ name: "客户C" }),
  })).json();
  const res = await t.app.request("/api/cases", {
    method: "POST",
    headers,
    body: JSON.stringify({ customerId: cus.id, type: "trademark", category: "注册申请" }),
  });
  assertEquals(res.status, 400);
});

Deno.test("TEST-010 筛选组合满足全部条件", async () => {
  const t = await makeApp();
  const { headers } = await authed(t);
  const cus = await (await t.app.request("/api/customers", {
    method: "POST", headers, body: JSON.stringify({ name: "客户D" }),
  })).json();
  const mk = (title: string, extra: Record<string, unknown>) =>
    t.app.request("/api/cases", {
      method: "POST",
      headers,
      body: JSON.stringify({ customerId: cus.id, type: "trademark", category: "注册申请", title, ...extra }),
    });
  await mk("甲案", { status: "active" });
  await mk("乙案", { status: "completed" });
  await mk("丙案", { status: "active" });
  const res = await t.app.request(`/api/cases?type=trademark&status=active&customerId=${cus.id}&q=案`, { headers });
  const list = await res.json();
  assertEquals(res.status, 200);
  assertEquals(list.length, 2);
  assertEquals(list.every((x: Record<string, unknown>) => x.type === "trademark" && x.status === "active" && x.customerId === cus.id), true);
});

Deno.test("TEST-011 案件不存在返回 404", async () => {
  const t = await makeApp();
  const { headers } = await authed(t);
  const id = "no-such-case";
  assertEquals((await t.app.request(`/api/cases/${id}`, { headers })).status, 404);
  assertEquals((await t.app.request(`/api/cases/${id}`, { method: "PUT", headers, body: "{}" })).status, 404);
  assertEquals((await t.app.request(`/api/cases/${id}`, { method: "DELETE", headers })).status, 404);
});

Deno.test("TEST-012 添加节点后案件 stage 同步", async () => {
  const t = await makeApp();
  const { headers } = await authed(t);
  const cus = await (await t.app.request("/api/customers", {
    method: "POST", headers, body: JSON.stringify({ name: "客户E" }),
  })).json();
  const cse = await (await t.app.request("/api/cases", {
    method: "POST",
    headers,
    body: JSON.stringify({ customerId: cus.id, type: "trademark", category: "驳回复审", title: "复审案" }),
  })).json();
  const res = await t.app.request(`/api/cases/${cse.id}/activities`, {
    method: "POST",
    headers,
    body: JSON.stringify({ stage: "提交复审申请", content: "已寄出材料", type: "申请" }),
  });
  assertEquals(res.status, 201);
  const after = await (await t.app.request(`/api/cases/${cse.id}`, { headers })).json();
  assertEquals(after.stage, "提交复审申请");
});

Deno.test("TEST-013 空节点内容返回 400", async () => {
  const t = await makeApp();
  const { headers } = await authed(t);
  const cus = await (await t.app.request("/api/customers", {
    method: "POST", headers, body: JSON.stringify({ name: "客户F" }),
  })).json();
  const cse = await (await t.app.request("/api/cases", {
    method: "POST",
    headers,
    body: JSON.stringify({ customerId: cus.id, type: "trademark", category: "注册申请", title: "案" }),
  })).json();
  const res = await t.app.request(`/api/cases/${cse.id}/activities`, {
    method: "POST",
    headers,
    body: JSON.stringify({ content: "  " }),
  });
  assertEquals(res.status, 400);
});

Deno.test("TEST-014 节点时间线倒序", async () => {
  const t = await makeApp();
  const { headers } = await authed(t);
  const cus = await (await t.app.request("/api/customers", {
    method: "POST", headers, body: JSON.stringify({ name: "客户G" }),
  })).json();
  const cse = await (await t.app.request("/api/cases", {
    method: "POST",
    headers,
    body: JSON.stringify({ customerId: cus.id, type: "trademark", category: "注册申请", title: "案" }),
  })).json();
  for (const content of ["第一步", "第二步", "第三步"]) {
    await t.app.request(`/api/cases/${cse.id}/activities`, {
      method: "POST", headers, body: JSON.stringify({ content }),
    });
  }
  const list = await (await t.app.request(`/api/cases/${cse.id}/activities`, { headers })).json();
  assertEquals(list.length, 3);
  assertEquals(list[0].content, "第三步");
  assertEquals(list[2].content, "第一步");
});
