import { z } from "zod";
import { fail, guard, toResponse } from "@/lib/jamjari/http";
import { entrust } from "@/lib/jamjari/service";

const Body = z.object({ ids: z.array(z.string().max(40)).max(100).optional() });

/** 잠자리채에 맡기기: 저장된 생각(draft)을 큐에 넣는다. "지금 실행"도 같은 경로 */
export async function POST(request: Request) {
  const denied = guard(request, true);
  if (denied) return denied;
  let body: unknown = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return fail(400, "bad_request", "JSON 본문이 올바르지 않습니다.");
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return fail(400, "bad_request", "ids 형식이 올바르지 않습니다.");
  try {
    return Response.json({ queued: entrust(parsed.data.ids) });
  } catch (error) {
    return toResponse(error, "api/jamjari/run");
  }
}
