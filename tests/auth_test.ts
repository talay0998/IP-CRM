// 认证测试（TDD-TEST-029..033）
import { assertEquals } from "jsr:@std/assert@^1";
import { makeApp, login, authed, type TestApp } from "./helper.ts";

Deno.test("TEST-029 未登录访问业务 API 返回 401", async () => {
  const t: TestApp = await makeApp();
  const res = await t.app.request("/api/customers");
  assertEquals(res.status, 401);
});

Deno.test("TEST-030 错误凭证登录返回 401", async () => {
  const t: TestApp = await makeApp();
  const token = await login(t.app, "alimjan", "wrong-pass");
  assertEquals(token, null);
});

Deno.test("TEST-031 正确凭证登录成功且带 Cookie 可访问受保护 API", async () => {
  const t: TestApp = await makeApp();
  const { token, headers } = await authed(t);
  assertEquals(typeof token, "string");
  const res = await t.app.request("/api/me", { headers });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { username: "alimjan" });
});

Deno.test("TEST-032 登出后旧 Cookie 失效", async () => {
  const t: TestApp = await makeApp();
  const { token } = await authed(t);
  const out = await t.app.request("/api/logout", {
    method: "POST",
    headers: { Cookie: `ipcrm_session=${token}` },
  });
  assertEquals(out.status, 200);
  const res = await t.app.request("/api/customers", {
    headers: { Cookie: `ipcrm_session=${token}` },
  });
  assertEquals(res.status, 401);
});

Deno.test("TEST-033 login 端点免认证", async () => {
  const t: TestApp = await makeApp();
  const res = await t.app.request("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "alimjan", password: "alimjan580" }),
  });
  assertEquals(res.status, 200);
});
