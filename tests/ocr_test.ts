// OCR 配置测试（OCR-001..003）
import { assertEquals, assertExists } from "jsr:@std/assert@^1";
import { makeApp, authed } from "./helper.ts";

Deno.test("OCR-001 未配置时 GET /api/settings/ocr 返回默认结构且 enabled=false", async () => {
  const t = await makeApp();
  const { headers } = await authed(t);
  const res = await t.app.request("/api/settings/ocr", { headers });
  assertEquals(res.status, 200);
  const cfg = await res.json();
  assertEquals(cfg.enabled, false);
  assertEquals(typeof cfg.secretId, "string");
  assertEquals(typeof cfg.region, "string");
});

Deno.test("OCR-002 保存 OCR 配置后回显，密码可被覆盖", async () => {
  const t = await makeApp();
  const { headers } = await authed(t);
  const save = await t.app.request("/api/settings/ocr", {
    method: "PUT", headers,
    body: JSON.stringify({ secretId: "AKIDxxxx", secretKey: "secret123", region: "ap-beijing", enabled: true }),
  });
  assertEquals(save.status, 200);
  const saved = await save.json();
  assertEquals(saved.secretId, "AKIDxxxx");
  assertEquals(saved.secretKey, "secret123");
  assertEquals(saved.region, "ap-beijing");
  assertEquals(saved.enabled, true);

  const get = await (await t.app.request("/api/settings/ocr", { headers })).json();
  assertEquals(get.secretId, "AKIDxxxx");
  assertEquals(get.enabled, true);
});

Deno.test("OCR-003 未登录访问 /api/settings/ocr 返回 401", async () => {
  const t = await makeApp();
  const res = await t.app.request("/api/settings/ocr");
  assertEquals(res.status, 401);
  assertExists((await res.json()).error);
});
