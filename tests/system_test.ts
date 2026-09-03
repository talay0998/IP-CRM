// 系统管理扩展测试：操作日志 / 系统设置 / 备份 / CSV 导出 / 统计 / 财务（MDD-MOD-004 扩展）
import { assert, assertEquals, assertObjectMatch } from "jsr:@std/assert@^1";
import { makeApp, authed } from "./helper.ts";
import type { TestApp } from "./helper.ts";

async function setup(): Promise<TestApp> {
  const t = await makeApp();
  const { headers } = await authed(t);
  const post = (url: string, body: unknown) =>
    t.app.request(url, { method: "POST", headers, body: JSON.stringify(body) });

  // 造数据：客户 + 案件 + 费用
  const c1 = await (await post("/api/customers", { name: "张三", company: "A 公司" })).json();
  const c2 = await (await post("/api/customers", { name: "李四", company: "B 公司" })).json();
  const case1 = await (await post("/api/cases", {
    customerId: c1.id, type: "trademark", category: "注册申请", title: "商标注册 A",
  })).json();
  await post("/api/cases", {
    customerId: c2.id, type: "copyright", category: "作品登记", title: "版权登记 B",
  });
  const fee = await (await post(`/api/cases/${case1.id}/fees`, {
    name: "代理费", kind: "official", amount: 30000, dueDate: "2026-09-01",
  })).json();
  await post(`/api/fees/${fee.id}/payments`, { amount: 10000, date: "2026-08-01" });
  return t;
}

Deno.test("LOG-001 写操作与登录会记录操作日志，清空日志有效", async () => {
  const t = await setup();
  const { headers } = await authed(t);

  const res = await t.app.request("/api/logs", { headers });
  assertEquals(res.status, 200);
  const logs: Array<{ module: string; action: string; operator: string }> = await res.json();
  assert(logs.length > 5, "应已记录登录 + 新增客户/案件/费用 + 收款日志");
  assert(logs.some((l) => l.module === "认证" && l.action === "登录"));
  assert(logs.some((l) => l.module === "客户" && l.action === "新增"));
  assert(logs.some((l) => l.module === "收款" && l.action === "新增"));
  assert(logs.every((l) => l.operator === "alimjan"));

  const del = await t.app.request("/api/logs", { method: "DELETE", headers });
  assertEquals(del.status, 200);
  const after = await (await t.app.request("/api/logs", { headers })).json();
  assertEquals(after.length, 1); // 仅剩"清空日志"自身这条
  t.close();
});

Deno.test("SET-001 设置读写：标题/联系人/SMTP 保存并可回读", async () => {
  const t = await setup();
  const { headers } = await authed(t);

  const put = await t.app.request("/api/settings", {
    method: "PUT",
    headers,
    body: JSON.stringify({
      siteTitle: "我的知产管理",
      contact: { name: "王五", company: "XX 所", phone: "13800000000", email: "a@b.com" },
      smtp: { host: "smtp.example.com", port: 587, username: "u", password: "p", from: "noreply@example.com", secure: false, enabled: true },
    }),
  });
  assertEquals(put.status, 200);
  const saved = await put.json();
  assertEquals(saved.siteTitle, "我的知产管理");
  assertEquals(saved.contact.name, "王五");
  assertEquals(saved.smtp.host, "smtp.example.com");

  const got = await (await t.app.request("/api/settings", { headers })).json();
  assertEquals(got.siteTitle, "我的知产管理");

  // 密码不回传时保留旧值
  const put2 = await t.app.request("/api/settings", {
    method: "PUT",
    headers,
    body: JSON.stringify({ siteTitle: "新标题" }),
  });
  const saved2 = await put2.json();
  assertEquals(saved2.smtp.password, "p");

  // 非法端口
  const bad = await t.app.request("/api/settings", {
    method: "PUT",
    headers,
    body: JSON.stringify({ smtp: { host: "x.com", port: 99999 } }),
  });
  assertEquals(bad.status, 400);
  t.close();
});

Deno.test("BAK-001 备份导出为 JSON，恢复后数据一致", async () => {
  const t = await setup();
  const { headers } = await authed(t);

  const meta = await (await t.app.request("/api/backup/meta", { headers })).json();
  assertObjectMatch(meta, { customers: 2, cases: 2, fees: 1 });

  const exp = await t.app.request("/api/backup/export", { headers });
  assertEquals(exp.status, 200);
  const data = await exp.json();
  assertEquals(data.customers.length, 2);
  assertEquals(data.cases.length, 2);

  // 修改数据后再恢复
  await t.app.request(`/api/customers/${data.customers[0].id}`, { method: "DELETE", headers });
  const after = await (await t.app.request("/api/backup/meta", { headers })).json();
  assertEquals(after.customers, 1);

  const rest = await t.app.request("/api/backup/restore", { method: "POST", headers, body: JSON.stringify(data) });
  assertEquals(rest.status, 200);
  const meta2 = await (await t.app.request("/api/backup/meta", { headers })).json();
  assertObjectMatch(meta2, { customers: 2, cases: 2, fees: 1 });
  t.close();
});

Deno.test("BAK-002 非法备份文件返回 400", async () => {
  const t = await makeApp();
  const { headers } = await authed(t);
  const res = await t.app.request("/api/backup/restore", { method: "POST", headers, body: "{\"foo\":1}" });
  assertEquals(res.status, 400);
  t.close();
});

Deno.test("EXP-001 CSV 导出各模块带中文表头", async () => {
  const t = await setup();
  const { headers } = await authed(t);
  for (const mod of ["customers", "cases", "activities", "fees", "deadlines"]) {
    const res = await t.app.request(`/api/export/${mod}`, { headers });
    assertEquals(res.status, 200, mod);
    const text = await res.text();
    assert(text.includes("姓名") || text.includes("客户") || text.includes("案件"), mod);
    assert(text.startsWith("\ufeff"), mod + " 应有 BOM");
  }
  const bad = await t.app.request("/api/export/nope", { headers });
  assertEquals(bad.status, 400);
  t.close();
});

Deno.test("STA-001 统计：案件分布 + 月度趋势 + 客户排名", async () => {
  const t = await setup();
  const { headers } = await authed(t);
  const res = await t.app.request("/api/stats", { headers });
  assertEquals(res.status, 200);
  const s = await res.json();
  assertObjectMatch(s.caseDistribution, { byType: { trademark: 1, copyright: 1 }, byStatus: { active: 2, completed: 0, terminated: 0 } });
  assert(s.feeTrend.length === 6);
  assert(s.topCustomers.length >= 2);
  const top = s.topCustomers[0];
  assertEquals(top.receivable, 30000);
  assertEquals(top.received, 10000);
  t.close();
});

Deno.test("FIN-001 财务全局列表含 join 与汇总", async () => {
  const t = await setup();
  const { headers } = await authed(t);
  const res = await t.app.request("/api/finance", { headers });
  assertEquals(res.status, 200);
  const f = await res.json();
  assertEquals(f.rows.length, 1);
  assertEquals(f.rows[0].customerName, "张三");
  assertEquals(f.rows[0].caseTitle, "商标注册 A");
  assertEquals(f.rows[0].status, "partial");
  assertObjectMatch(f.summary, { receivable: 30000, received: 10000, pending: 20000 });

  const q = await (await t.app.request("/api/finance?status=paid", { headers })).json();
  assertEquals(q.rows.length, 0);
  t.close();
});
