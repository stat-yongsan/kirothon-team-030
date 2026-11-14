import { connection } from "next/server";
import { guard } from "@/lib/jamjari/http";
import { readArtifact } from "@/lib/jamjari/store";

// W2 영상(MP4). 브라우저 재생에 필요한 Range 요청을 처리한다.
const HEADERS = {
  "content-type": "video/mp4",
  "accept-ranges": "bytes",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "cache-control": "no-store",
};

export async function GET(request: Request, ctx: RouteContext<"/v/[id]">) {
  await connection();
  const denied = guard(request, false);
  if (denied) return denied;
  const { id } = await ctx.params;
  const file = readArtifact(id, "mp4");
  if (!file) return new Response("영상을 찾을 수 없습니다.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const size = file.length;
  const url = new URL(request.url);
  const disposition: Record<string, string> = url.searchParams.get("download") === "1" ? { "content-disposition": `attachment; filename="jamjarichae-${id}.mp4"` } : {};

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { ...HEADERS, "content-range": `bytes */${size}` } });
    return new Response(new Uint8Array(file.subarray(start, end + 1)), {
      status: 206,
      headers: { ...HEADERS, ...disposition, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
    });
  }
  return new Response(new Uint8Array(file), { headers: { ...HEADERS, ...disposition, "content-length": String(size) } });
}
