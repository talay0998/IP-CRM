// 会话认证模块（MDD-MOD-006 / MDD-API-001）
import type { MiddlewareHandler } from "jsr:@hono/hono@^4";
import type { Db } from "./db.ts";
import { newId, now } from "./types.ts";

export const SESSION_COOKIE = "ipcrm_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

const PUBLIC_PATHS = new Set(["/api/login", "/api/health"]);

/** Hono 上下文变量：登录令牌 + 当前用户 */
export type Vars = { token: string; username: string };

export function createAuth(db: Db, cred: { username: string; password: string }) {
  async function validate(token: string | undefined): Promise<boolean> {
    if (!token) return false;
    const s = await db.getSession(token);
    if (!s) return false;
    if (s.expiresAt < now()) {
      await db.deleteSession(token);
      return false;
    }
    return true;
  }

  return {
    async login(username: string, password: string): Promise<string | null> {
      if (username !== cred.username || password !== cred.password) return null;
      const token = newId();
      await db.setSession({ token, createdAt: now(), expiresAt: now() + SESSION_TTL_MS });
      return token;
    },
    async logout(token: string): Promise<void> {
      await db.deleteSession(token);
    },
    validate,
    /** 保护所有 /api/*（除 login、health），校验通过后把 token 与 username 写入 context */
    requireAuth: (((): MiddlewareHandler<{ Variables: Vars }> => {
      return async (c, next) => {
        if (PUBLIC_PATHS.has(c.req.path)) return next();
        const token = parseCookies(c.req.header("cookie"))[SESSION_COOKIE];
        if (!(await validate(token))) {
          return c.json({ error: "未登录或会话已过期" }, 401);
        }
        c.set("token", token!);
        c.set("username", cred.username);
        return next();
      };
    })()),
  };
}

export type Auth = ReturnType<typeof createAuth>;
