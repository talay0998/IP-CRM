// 客户测试（TDD-TEST-001..005）
import { assertEquals } from "jsr:@std/assert@^1";
import { makeApp, authed } from "./helper.ts";

async function createCustomer(headers: Record<string, string>, overrides: Record<string, unknown> = {}) {
  const t = await makeApp();
  const { headers: h } = await authed(t);
  const res = await t.app.request("/api/customers", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ name: "测试客户", company: "甲公司", phone: "13800000000", ...overrides }),
  });
  const customer = await res.json();
  return { t, customer, res };
}

Deno.test("TEST-001 创建合法客户返回 201 且字段回显", async () => {
  const { t, res, customer } = await createCustomer({}, {});
  assertEquals(res.status, 201);
  assertEquals(typeof customer.id, "string");
  assertEquals(customer.name, "测试客户");
  assertEquals(customer.company, "甲公司");
  assertEquals(customer.phone, "13800000000");
});

Deno.test("TEST-002 name 为空返回 400", async () => {
  const t = await makeApp();
  const { headers } = await authed(t);
  const res = await t.app.request("/api/customers", {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "  " }),
  });
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "姓名不能为空");
});

Deno.test("TEST-003 客户不存在时 GET/PUT/DELETE 返回 404", async () => {
  const t = await makeApp();
  const { headers } = await authed(t);
  const id = "no-such-id";
  assertEquals((await t.app.request(`/api/customers/${id}`, { headers })).status, 404);
  assertEquals((await t.app.request(`/api/customers/${id}`, { method: "PUT", headers, body: "{}" })).status, 404);
  assertEquals((await t.app.request(`/api/customers/${id}`, { method: "DELETE", headers })).status, 404);
});

Deno.test("TEST-004 部分更新只改传入字段", async () => {
  const { t, customer } = await createCustomer({}, {});
  const { headers } = await authed(t);
  const res = await t.app.request(`/api/customers/${customer.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ phone: "13900000000" }),
  });
  assertEquals(res.status, 200);
  const updated = await res.json();
  assertEquals(updated.phone, "13900000000");
  assertEquals(updated.name, "测试客户");
  assertEquals(updated.company, "甲公司");
});

Deno.test("TEST-005 列表按 updatedAt 倒序且支持搜索", async () => {
  const t = await makeApp();
  const { headers } = await authed(t);
  const mk = async (name: string) => {
    await t.app.request("/api/customers", {
      method: "POST",
      headers,
      body: JSON.stringify({ name }),
    });
  };
  await mk("张三");
  await mk("李四");
  await mk("王五");
  const res = await t.app.request("/api/customers?q=李", { headers });
  const list = await res.json();
  assertEquals(res.status, 200);
  assertEquals(list.length, 1);
  assertEquals(list[0].name, "李四");
  const all = await (await t.app.request("/api/customers", { headers })).json();
  for (let i = 1; i < all.length; i++) {
    if (all[i - 1].updatedAt < all[i].updatedAt) throw new Error("排序错误");
  }
});

Deno.test("TEST-006 新字段回显：kind/idNo/地址/经办人", async () => {
  const { t, res, customer } = await createCustomer({}, {
    kind: "sole",
    idNo: "92370214MA3D5T123X",
    address: "青岛市市南区某路",
    contactName: "王经办",
    contactPhone: "13911112222",
    contactEmail: "wang@example.com",
  });
  assertEquals(res.status, 201);
  assertEquals(customer.kind, "sole");
  assertEquals(customer.idNo, "92370214MA3D5T123X");
  assertEquals(customer.contactName, "王经办");
  assertEquals(customer.contactEmail, "wang@example.com");
  assertEquals(customer.address, "青岛市市南区某路");
});

Deno.test("TEST-007 非法 kind 回退为 company", async () => {
  const { t, res, customer } = await createCustomer({}, { kind: "非法类型" });
  assertEquals(res.status, 201);
  assertEquals(customer.kind, "company");
});

Deno.test("TEST-008 搜索支持证照号与经办人，支持 kind 筛选", async () => {
  const t = await makeApp();
  const { headers } = await authed(t);
  await t.app.request("/api/customers", {
    method: "POST", headers,
    body: JSON.stringify({ name: "某公司", kind: "company", idNo: "91370000MA12345", contactName: "刘法务" }),
  });
  await t.app.request("/api/customers", {
    method: "POST", headers,
    body: JSON.stringify({ name: "个体户老张", kind: "sole", idNo: "92370214MA67890" }),
  });
  const byId = await (await t.app.request("/api/customers?q=91370000MA12345", { headers })).json();
  assertEquals(byId.length, 1);
  assertEquals(byId[0].name, "某公司");
  const byContact = await (await t.app.request("/api/customers?q=刘法务", { headers })).json();
  assertEquals(byContact.length, 1);
  assertEquals(byContact[0].name, "某公司");
  const sole = await (await t.app.request("/api/customers?kind=sole", { headers })).json();
  assertEquals(sole.length, 1);
  assertEquals(sole[0].name, "个体户老张");
});
