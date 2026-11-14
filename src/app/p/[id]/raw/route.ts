import { connection } from "next/server";
import { guard } from "@/lib/jamjari/http";
import { readArtifact } from "@/lib/jamjari/store";

// 생성 코드는 신뢰하지 않는다(R3.6, AC-09).
// CSP sandbox(allow-scripts만) → 직접 열어도 불투명 출처라 앱 쿠키·저장소·API에 접근할 수 없다.
// default-src 'none' → 외부 네트워크·리소스 차단. 인라인 스크립트·스타일과 data: 이미지만 허용.
const CSP = [
  "sandbox allow-scripts",
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "font-src data:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'self'",
].join("; ");

export async function GET(request: Request, ctx: RouteContext<"/p/[id]/raw">) {
  await connection();
  const denied = guard(request, false);
  if (denied) return denied;
  const { id } = await ctx.params;
  const html = readArtifact(id, "html");
  if (!html) return new Response("체험 페이지를 찾을 수 없습니다.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(html), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": CSP,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "cache-control": "no-store",
      ...(download ? { "content-disposition": `attachment; filename="jamjarichae-prototype-${id}.html"` } : {}),
    },
  });
}
