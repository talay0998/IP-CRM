// 销售线索 + 多业务类型测试
import { assertEquals } from "jsr:@std/assert@^1";
import { makeApp, authed } from "./helper.ts";

Deno.test("LEAD-001 线索 CRUD 与状态流转", async () => {
  const t = await makeApp();
  try {
    const { headers } = await authed(t);

    const created = await (await t.app.request("/api/leads", {
      method: "POST", headers,
      body: JSON.stringify({ name: "张三", phone: "138", company: "某公司", source: "referral", businessType: "software" }),
    })).json();
    assertEquals(created.name, "张三");
    assertEquals(created.status, "new");
    assertEquals(created.source, "referral");

    // 更新状态
    const updated = await (await t.app.request(`/api/leads/${created.id}`, {
      method: "PUT", headers,
      body: JSON.stringify({ status: "qualified" }),
    })).json();
    assertEquals(updated.status, "qualified");

    // 列表
    const list = await (await t.app.request("/api/leads", { headers })).json();
    assertEquals(list.length, 1);

    // 字段校验：非法状态
    const bad = await t.app.request("/api/leads", {
      method: "POST", headers,
      body: JSON.stringify({ name: "x", status: "nope" }),
    });
    assertEquals(bad.status, 400);

    await t.app.request(`/api/leads/${created.id}`, { method: "DELETE", headers });
    const after = await (await t.app.request("/api/leads", { headers })).json();
    assertEquals(after.length, 0);
  } finally {
    t.close();
  }
});

Deno.test("LEAD-002 线索转化为客户", async () => {
  const t = await makeApp();
  try {
    const { headers } = await authed(t);
    const lead = await (await t.app.request("/api/leads", {
      method: "POST", headers,
      body: JSON.stringify({ name: "李四", company: "软件公司", businessType: "software" }),
    })).json();

    const converted = await (await t.app.request(`/api/leads/${lead.id}/convert`, {
      method: "POST", headers,
      body: JSON.stringify({ name: "李四", company: "软件公司" }),
    })).json();
    assertEquals(converted.status, "won");
    assertEquals(converted.customerId.length > 0, true);

    const customer = await (await t.app.request(`/api/customers/${converted.customerId}`, { headers })).json();
    assertEquals(customer.name, "李四");
  } finally {
    t.close();
  }
});

Deno.test("MULTI-001 多业务类型案件可用", async () => {
  const t = await makeApp();
  try {
    const { headers } = await authed(t);
    const cus = await (await t.app.request("/api/customers", {
      method: "POST", headers, body: JSON.stringify({ name: "客户M" }),
    })).json();

    const cases: { type: string; category: string }[] = [
      { type: "software-copyright", category: "软件著作权登记" },
      { type: "legal-consult", category: "合同审查" },
      { type: "registration", category: "公司设立" },
      { type: "software", category: "定制开发" },
      { type: "service", category: "信息系统运维" },
    ];
    for (const cse of cases) {
      const res = await t.app.request("/api/cases", {
        method: "POST", headers,
        body: JSON.stringify({ customerId: cus.id, type: cse.type, category: cse.category, title: cse.type }),
      });
      assertEquals(res.status, 201, `${cse.type} 应可创建`);
    }

    // 非法子类应被拒绝
    const bad = await t.app.request("/api/cases", {
      method: "POST", headers,
      body: JSON.stringify({ customerId: cus.id, type: "software", category: "作品登记", title: "非法" }),
    });
    assertEquals(bad.status, 400);

    const list = await (await t.app.request("/api/cases", { headers })).json();
    assertEquals(list.length, 5);

    // 元数据接口提供业务字典
    const biz = await (await t.app.request("/api/meta/business", { headers })).json();
    assertEquals(biz.length, 7);
  } finally {
    t.close();
  }
});

Deno.test("MULTI-002 期限规则建议", async () => {
  const t = await makeApp();
  try {
    const { headers } = await authed(t);
    const res = await t.app.request("/api/meta/deadline-suggest", {
      method: "POST", headers,
      body: JSON.stringify({ type: "trademark", category: "注册申请" }),
    });
    const body = await res.json();
    assertEquals(res.status, 200);
    assertEquals(body.suggestions.length >= 2, true);
  } finally {
    t.close();
  }
});
