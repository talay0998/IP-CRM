// 腾讯云 API 3.0（TC3-HMAC-SHA256）签名与 OCR 封装
const enc = (s: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(s) as Uint8Array<ArrayBuffer>;
const hex = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

async function sha256Hex(msg: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc(msg))) as Uint8Array<ArrayBuffer>);
}

async function hmacBytes(keyBytes: Uint8Array<ArrayBuffer>, msg: string): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc(msg))) as Uint8Array<ArrayBuffer>;
}

export interface TencentCred {
  secretId: string;
  secretKey: string;
  region?: string;
}

/** 从环境变量读取腾讯云凭据；未配置返回 null */
export function tencentCredFromEnv(): TencentCred | null {
  const secretId = Deno.env.get("TENCENT_SECRET_ID");
  const secretKey = Deno.env.get("TENCENT_SECRET_KEY");
  if (!secretId || !secretKey) return null;
  return { secretId, secretKey, region: Deno.env.get("TENCENT_OCR_REGION") || "ap-guangzhou" };
}

/**
 * 腾讯云 API 3.0 TC3 签名（仅 HMAC-SHA256，可用 Web Crypto 实现）
 * 返回 Authorization 头与签名用到的 headers。
 */
export async function tc3Sign(
  { secretId, secretKey, region = "ap-guangzhou" }: TencentCred,
  opts: { method?: string; service: string; host: string; action: string; version: string; payload: string; timestamp?: number },
): Promise<{ headers: Record<string, string>; authorization: string }> {
  const { method = "POST", service, host, action, version, payload } = opts;
  const ts = String(opts.timestamp ?? Math.floor(Date.now() / 1000));
  const date = new Date(Number(ts) * 1000).toISOString().slice(0, 10); // UTC 日期
  const credentialScope = `${date}/${service}/tc3_request`;

  // 参与签名与发送的 headers（按字母序）
  const contentType = "application/json; charset=utf-8";
  const signedHeaders = "content-type;host;x-tc-action;x-tc-region;x-tc-timestamp;x-tc-version";
  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-tc-action:${action.toLowerCase()}\n` +
    `x-tc-region:${region}\n` +
    `x-tc-timestamp:${ts}\n` +
    `x-tc-version:${version}\n`;

  const canonicalRequest =
    `${method}\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${await sha256Hex(payload)}`;

  const stringToSign =
    `TC3-HMAC-SHA256\n${ts}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;

  const secretDate = await hmacBytes(enc("TC3" + secretKey), date);
  const secretService = await hmacBytes(secretDate, service);
  const secretSigning = await hmacBytes(secretService, "tc3_request");
  const signature = await hmacBytes(secretSigning, stringToSign);
  const signatureHex = hex(signature);

  const authorization =
    `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;

  return {
    headers: {
      "Content-Type": contentType,
      Host: host,
      "X-TC-Action": action,
      "X-TC-Version": version,
      "X-TC-Timestamp": ts,
      "X-TC-Region": region,
    },
    authorization,
  };
}

/** 调用腾讯云 OCR 接口（ocr.tencentcloudapi.com），返回响应 JSON */
export async function ocrRecognize(
  cred: TencentCred,
  action: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const host = "ocr.tencentcloudapi.com";
  const version = "2018-11-19";
  const payload = JSON.stringify(params);
  const { headers, authorization } = await tc3Sign(cred, {
    service: "ocr",
    host,
    action,
    version,
    payload,
  });

  const res = await fetch(`https://${host}/`, {
    method: "POST",
    headers: { ...headers, Authorization: authorization },
    body: payload,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json as { Error?: unknown }).Error) {
    const e = (json as { Error?: { Code?: string; Message?: string } }).Error;
    throw new Error(e?.Message || `OCR 请求失败（HTTP ${res.status}）`);
  }
  return json as Record<string, unknown>;
}
