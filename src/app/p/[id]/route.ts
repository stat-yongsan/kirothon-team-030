import { connection } from "next/server";
import { guard } from "@/lib/jamjari/http";
import { ID_RE, readArtifact } from "@/lib/jamjari/store";

// 체험 URL: 앱 표식 + sandbox iframe. allow-same-origin을 주지 않는다(같은 출처 + 스크립트 동시 허용 금지).
const CSP = "default-src 'none'; style-src 'unsafe-inline'; frame-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

export async function GET(request: Request, ctx: RouteContext<"/p/[id]">) {
  await connection();
  const denied = guard(request, false);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!ID_RE.test(id) || !readArtifact(id, "html")) {
    return new Response("체험 페이지를 찾을 수 없습니다.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>체험 페이지 · 잠자리채</title>
<style>body{margin:0;font-family:"Pretendard","Malgun Gothic",system-ui,sans-serif;background:#fdf7e8}
.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 14px;border-bottom:3px solid #111;background:#ffd23f;font-size:14px}
.bar strong{font-size:15px}.bar a{color:#111;font-weight:700}iframe{display:block;width:100%;height:calc(100vh - 52px);border:0;background:#fff}</style></head>
<body><div class="bar"><strong>잠자리채 체험 페이지</strong><span>AI가 만든 격리 페이지 · 외부 네트워크 차단 · 가상 데이터</span><a href="/p/${id}/raw?download=1">HTML 내려받기</a><a href="/">← 아침 브리핑</a></div>
<iframe title="생성된 체험 페이지" sandbox="allow-scripts" referrerpolicy="no-referrer" src="/p/${id}/raw"></iframe></body></html>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": CSP, "x-content-type-options": "nosniff", "cache-control": "no-store" },
  });
}
