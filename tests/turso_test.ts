// Turso 云端备份测试：仅在配置了 TURSO_URL/TURSO_AUTH_TOKEN 时运行
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { createTursoClient, listSnapshots, pullLatestSnapshot, pushSnapshot } from "../src/turso.ts";
import type { BackupData } from "../src/db.ts";

const configured = !!(Deno.env.get("TURSO_URL") && Deno.env.get("TURSO_AUTH_TOKEN"));

const sample: BackupData = {
  customers: [{ id: "c1", name: "云端客户", kind: "company", company: "T 公司", idNo: "", address: "", phone: "", email: "", contactName: "", contactPhone: "", contactEmail: "", note: "", createdAt: 1, updatedAt: 1 }],
  cases: [{ id: "k1", customerId: "c1", type: "trademark", category: "注册申请", title: "云端商标", appNo: "", applyDate: "", status: "active", stage: "注册申请", note: "", createdAt: 1, updatedAt: 1 }],
  activities: [],
  fees: [],
  deadlines: [],
  leads: [],
  settings: { siteTitle: "IP-CRM", contact: { name: "", company: "", phone: "", email: "" }, company: { fullName: "", shortName: "", address: "", scope: "", business: "", icp: "", website: "", logo: "" }, smtp: { host: "", port: 465, username: "", password: "", from: "", secure: true, enabled: false }, ocr: { secretId: "", secretKey: "", region: "ap-guangzhou", enabled: false }, updatedAt: 0 },
};

Deno.test("TUR-001 推拉快照：push 后可 list 与 pull 且数据一致", { ignore: !configured }, async () => {
  const client = createTursoClient()!;
  try {
    const id = await pushSnapshot(client, sample);
    assert(id.length > 0);

    const snaps = await listSnapshots(client, 20);
    assert(snaps.length >= 1);
    const newest = snaps[0];
    assertEquals(newest.id, id);
    assertEquals(newest.counts.customers, 1);
    assertEquals(newest.counts.cases, 1);

    const pulled = await pullLatestSnapshot(client);
    assertEquals(pulled!.customers.length, 1);
    assertEquals(pulled!.cases[0].title, "云端商标");
    assertEquals(pulled!.settings.siteTitle, "IP-CRM");
  } finally {
    client.close();
  }
});

Deno.test("TUR-002 未配置时 createTursoClient 返回 null", async () => {
  const nullEnv = {
    get: (k: string) => (k === "TURSO_URL" || k === "TURSO_AUTH_TOKEN" ? undefined : undefined),
  } as unknown as Deno.Env;
  assertEquals(createTursoClient(nullEnv), null);
});
