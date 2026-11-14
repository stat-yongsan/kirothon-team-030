// URL 본문 수집기. http/https만, 사설·루프백·링크로컬·메타데이터 주소 차단, 리다이렉트마다 재검사, 크기·시간 제한.
import { lookup } from "node:dns/promises";
import net from "node:net";

export const FETCH_LIMITS = { timeoutMs: 10_000, maxBytes: 2_000_000, maxRedirects: 3, maxTextChars: 20_000 };

export class UrlBlockedError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** 사설·내부 주소 여부(IPv4/IPv6) */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  return true;
}

export type Resolver = (host: string) => Promise<string[]>;

const defaultResolver: Resolver = async (host) => (await lookup(host, { all: true })).map((r) => r.address);

/** 접속 전에 URL을 검사한다. 통과하지 못하면 UrlBlockedError */
export async function assertPublicUrl(raw: string, resolve: Resolver = defaultResolver): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new UrlBlockedError("bad_url", "URL 형식이 아닙니다.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new UrlBlockedError("bad_protocol", "http/https URL만 읽습니다.");
  if (u.username || u.password) throw new UrlBlockedError("credentials", "계정 정보가 들어 있는 URL은 읽지 않습니다.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new UrlBlockedError("private_host", "내부 주소는 읽지 않습니다.");
  }
  const addrs = net.isIP(host) ? [host] : await resolve(host).catch(() => {
    throw new UrlBlockedError("dns", "주소를 찾을 수 없습니다.");
  });
  if (addrs.length === 0 || addrs.some(isPrivateAddress)) throw new UrlBlockedError("private_host", "내부·사설 주소는 읽지 않습니다.");
  return u;
}

export interface FetchedPage {
  finalUrl: string;
  status: number;
  contentType: string;
  title: string | null;
  text: string;
  truncated: boolean;
}

export function htmlToText(html: string): { title: string | null; text: string } {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null;
  const text = html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return { title: title ? htmlToText(title).text : null, text };
}

async function readLimited(res: Response, maxBytes: number): Promise<{ body: string; truncated: boolean }> {
  if (!res.body) return { body: "", truncated: false };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return { body: new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks)), truncated };
}

/** 공개 웹페이지를 읽어 텍스트로 돌려준다. 로그인벽·차단은 우회하지 않는다 */
export async function fetchPublicPage(raw: string, deps: { resolve?: Resolver; fetchImpl?: typeof fetch } = {}): Promise<FetchedPage> {
  const doFetch = deps.fetchImpl ?? fetch;
  let current = raw;
  for (let hop = 0; hop <= FETCH_LIMITS.maxRedirects; hop++) {
    const u = await assertPublicUrl(current, deps.resolve);
    const res = await doFetch(u, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_LIMITS.timeoutMs),
      headers: { "user-agent": "Mozilla/5.0 (jamjarichae MVP reader)", accept: "text/html,text/plain;q=0.9,*/*;q=0.1" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location") as string, u).toString();
      continue;
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok) throw new UrlBlockedError("http_status", `페이지가 ${res.status} 응답을 보냈습니다.`);
    if (!/text\/html|text\/plain|application\/xhtml/.test(contentType)) {
      throw new UrlBlockedError("content_type", `텍스트 페이지가 아닙니다(${contentType || "형식 미상"}).`);
    }
    const { body, truncated } = await readLimited(res, FETCH_LIMITS.maxBytes);
    const parsed = contentType.includes("html") ? htmlToText(body) : { title: null, text: body };
    const clipped = parsed.text.length > FETCH_LIMITS.maxTextChars;
    return {
      finalUrl: u.toString(),
      status: res.status,
      contentType,
      title: parsed.title,
      text: parsed.text.slice(0, FETCH_LIMITS.maxTextChars),
      truncated: truncated || clipped,
    };
  }
  throw new UrlBlockedError("redirects", "리다이렉트가 너무 많습니다.");
}

/** 출처 URL이 실제로 응답하는지 확인(코드 판정). 본문은 읽지 않는다 */
export async function probeUrl(raw: string, deps: { resolve?: Resolver; fetchImpl?: typeof fetch } = {}): Promise<{ reachable: boolean; status: number | null }> {
  const doFetch = deps.fetchImpl ?? fetch;
  try {
    const u = await assertPublicUrl(raw, deps.resolve);
    const res = await doFetch(u, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
      headers: { "user-agent": "Mozilla/5.0 (jamjarichae source check)", range: "bytes=0-2047" },
    });
    await res.body?.cancel().catch(() => undefined);
    return { reachable: res.status < 400, status: res.status };
  } catch {
    return { reachable: false, status: null };
  }
}
