// 测试支撑（MDD-MOD-005）：临时 SQLite 库 + 组装 app + 登录辅助
import { createSqlDb, initSchema } from "../src/sqldb.ts";
import { createLocalClient } from "../src/localsql.ts";
import { createAuth, SESSION_COOKIE } from "../src/auth.ts";
import { createApp } from "../src/app.ts";

const TEST_USER = "alimjan";
const TEST_PASS = "alimjan580";

export interface TestApp {
  app: ReturnType<typeof createApp>;
  db: ReturnType<typeof createSqlDb>;
  /** 关闭底层数据库连接 */
  close: () => void;
  dir: string;
}

export async function makeApp(): Promise<TestApp> {
  const dir = await Deno.makeTempDir();
  const client = createLocalClient(dir + "/test.sqlite");
  await initSchema(client);
  const db = createSqlDb(client);
  const auth = createAuth(db, { username: TEST_USER, password: TEST_PASS });
  const app = createApp(db, auth, TEST_USER);
  return { app, db, close: () => client.close(), dir };
}

export async function login(
  app: ReturnType<typeof createApp>,
  username: string,
  password: string,
): Promise<string | null> {
  const res = await app.request("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (res.status !== 200) return null;
  const setCookie = res.headers.get("set-cookie") ?? "";
  const m = setCookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return m ? m[1] : null;
}

export async function authed(t: TestApp): Promise<{ token: string; headers: Record<string, string> }> {
  const token = await login(t.app, TEST_USER, TEST_PASS);
  if (!token) throw new Error("login failed");
  return { token, headers: { "Content-Type": "application/json", Cookie: `${SESSION_COOKIE}=${token}` } };
}

export const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
