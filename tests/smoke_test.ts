// 冒烟测试（TDD-TEST-026 / 027）
import { assertEquals } from "jsr:@std/assert@^1";
import { makeApp, authed } from "./helper.ts";

Deno.test("TEST-026 health 端点返回 200", async () => {
  const t = await makeApp();
  const res = await t.app.request("/api/health");
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: true });
});

Deno.test("TEST-027 未知 API 路径返回 404 JSON", async () => {
  const t = await makeApp();
  const { headers } = await authed(t);
  const res = await t.app.request("/api/no-such-route", { headers });
  assertEquals(res.status, 404);
  assertEquals((await res.json()).error, "接口不存在");
});
