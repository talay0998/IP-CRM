// SMTP 客户端：连接测试与真实发信（原生 socket，QQ 465 隐式 TLS / 587 STARTTLS）
import type { SmtpConfig } from "./types.ts";

export interface SmtpMessage {
  to: string;
  subject: string;
  body: string; // 纯文本正文（UTF-8，发送时自动 base64）
}

export type SmtpResult = { ok: boolean; message: string };

function b64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** RFC2047 编码中文主题 */
function encodeSubject(subject: string): string {
  return /[\x80-\uffff]/.test(subject) ? `=?UTF-8?B?${b64(subject)}?=` : subject;
}

/** base64 按 76 列换行 */
function b64Wrap(s: string, cols = 76): string {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += cols) out.push(s.slice(i, i + cols));
  return out.join("\r\n");
}

class LineReader {
  private buffer = "";
  constructor(private reader: ReadableStreamDefaultReader<Uint8Array>) {}
  async next(): Promise<string> {
    while (true) {
      const idx = this.buffer.indexOf("\n");
      if (idx >= 0) {
        const line = this.buffer.slice(0, idx).replace(/\r$/, "");
        this.buffer = this.buffer.slice(idx + 1);
        return line;
      }
      const { done, value } = await this.reader.read();
      if (done) return this.buffer;
      this.buffer += new TextDecoder().decode(value);
    }
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("连接超时")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** 读取 SMTP 应答；多行（`250-` 延续）读完整个应答，返回最后一行 */
async function readReply(reader: LineReader): Promise<string> {
  let line = await withTimeout(reader.next(), 10000);
  if (line === "") return "";
  let last = line;
  while (line.length >= 4 && line[3] === "-") {
    last = line;
    line = await withTimeout(reader.next(), 10000);
    if (line === "") return "";
  }
  return last;
}

interface SessionCtx {
  send(line: string): Promise<void>;
  expect(codes: number[], stage: string): Promise<string>;
  conn: Deno.TcpConn | Deno.TlsConn;
}

/** 建立连接 → EHLO → (STARTTLS) → AUTH，完成后调用 fn 继续，最后 QUIT */
async function smtpSession<T>(
  s: SmtpConfig,
  fn: (ctx: SessionCtx) => Promise<T>,
): Promise<{ ok: boolean; message: string; value?: T }> {
  if (!s.host) return { ok: false, message: "未配置 SMTP 服务器地址" };
  const port = s.port || (s.secure ? 465 : 587);
  let conn: Deno.TcpConn | Deno.TlsConn;
  try {
    conn = s.secure
      ? await withTimeout(Deno.connectTls({ hostname: s.host, port }), 10000)
      : await withTimeout(Deno.connect({ hostname: s.host, port }), 10000);
  } catch {
    return { ok: false, message: `无法连接到 ${s.host}:${port}` };
  }

  const reader = new LineReader(conn.readable.getReader());
  const writer = conn.writable.getWriter();

  const send = async (line: string) => {
    await withTimeout(writer.write(new TextEncoder().encode(line + "\r\n")), 10000);
  };
  const expect = async (codes: number[], stage: string): Promise<string> => {
    const line = await readReply(reader);
    if (line === "") throw new Error(`${stage}：连接被关闭`);
    const code = Number(line.slice(0, 3));
    if (!codes.includes(code)) throw new Error(`${stage}：服务器返回 ${code} ${line.slice(4)}`);
    return line;
  };

  try {
    await expect([220], "服务器问候");
    await send("EHLO ip-crm.local");
    await expect([250], "EHLO");

    if (!s.secure) {
      await send("STARTTLS");
      await expect([220], "STARTTLS");
      conn = await withTimeout(Deno.startTls(conn as Deno.TcpConn, { hostname: s.host }), 10000);
      const reader2 = new LineReader(conn.readable.getReader());
      const writer2 = conn.writable.getWriter();
      const send2 = async (line: string) => {
        await withTimeout(writer2.write(new TextEncoder().encode(line + "\r\n")), 10000);
      };
      const expect2 = async (codes: number[], stage: string): Promise<string> => {
        const line = await readReply(reader2);
        if (line === "") throw new Error(`${stage}：连接被关闭`);
        const code = Number(line.slice(0, 3));
        if (!codes.includes(code)) throw new Error(`${stage}：服务器返回 ${code} ${line.slice(4)}`);
        return line;
      };
      await send2("EHLO ip-crm.local");
      await expect2([250], "EHLO");
      if (s.username) {
        await send2("AUTH LOGIN");
        await expect2([334], "AUTH");
        await send2(b64(s.username));
        await expect2([334], "用户名");
        await send2(b64(s.password));
        await expect2([235], "认证");
      }
      const value = await fn({ send: send2, expect: expect2, conn });
      try { await send2("QUIT"); } catch { /* ignore */ }
      try { await conn.close(); } catch { /* ignore */ }
      return { ok: true, message: "连接成功", value };
    }

    if (s.username) {
      await send("AUTH LOGIN");
      await expect([334], "AUTH");
      await send(b64(s.username));
      await expect([334], "用户名");
      await send(b64(s.password));
      await expect([235], "认证");
    }
    const value = await fn({ send, expect, conn });
    try { await send("QUIT"); } catch { /* ignore */ }
    try { await conn.close(); } catch { /* ignore */ }
    return { ok: true, message: "连接成功", value };
  } catch (e) {
    try { await conn.close(); } catch { /* ignore */ }
    return { ok: false, message: e instanceof Error ? e.message : "测试失败" };
  }
}

/** 测试连接：EHLO → (STARTTLS) → AUTH LOGIN → QUIT */
export function testSmtp(s: SmtpConfig): Promise<SmtpResult> {
  return smtpSession(s, async () => {});
}

/** 发送一封纯文本邮件（正文 base64，中文安全） */
export async function sendEmail(s: SmtpConfig, msg: SmtpMessage): Promise<SmtpResult> {
  const from = s.from || s.username;
  if (!from) return { ok: false, message: "未配置发件地址" };
  if (!msg.to) return { ok: false, message: "收件地址为空" };
  const data = [
    `From: ${from}`,
    `To: ${msg.to}`,
    `Subject: ${encodeSubject(msg.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64Wrap(b64(msg.body)),
    ".",
  ].join("\r\n");
  return smtpSession(s, async (ctx) => {
    await ctx.send(`MAIL FROM:<${from}>`);
    await ctx.expect([250], "发件人");
    await ctx.send(`RCPT TO:<${msg.to}>`);
    await ctx.expect([250, 251], "收件人");
    await ctx.send("DATA");
    await ctx.expect([354], "DATA");
    for (const line of data.split("\r\n")) await ctx.send(line);
    await ctx.expect([250], "发送");
  });
}
