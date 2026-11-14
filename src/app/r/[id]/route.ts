import { connection } from "next/server";
import { guard } from "@/lib/jamjari/http";
import { readArtifact } from "@/lib/jamjari/store";

// 신뢰 템플릿으로 만든 보고서. 스크립트를 허용하지 않는 CSP를 붙인다(R5.4).
const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";

export async function GET(request: Request, ctx: RouteContext<"/r/[id]">) {
  await connection();
  const denied = guard(request, false);
  if (denied) return denied;
  const { id } = await ctx.params;
  const html = readArtifact(id, "html");
  if (!html) return new Response("결과를 찾을 수 없습니다.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(html), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": CSP,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "cache-control": "no-store",
      ...(download ? { "content-disposition": `attachment; filename="jamjarichae-${id}.html"` } : {}),
    },
  });
}
