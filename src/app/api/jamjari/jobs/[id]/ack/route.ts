import { toView } from "@/domain/jamjarichae/job";
import { guard, toResponse } from "@/lib/jamjari/http";
import { acknowledge } from "@/lib/jamjari/service";

/** 확인완료: 아침 화면에서 빼고 전체 결과함으로 보낸다 */
export async function POST(request: Request, ctx: RouteContext<"/api/jamjari/jobs/[id]/ack">) {
  const denied = guard(request, true);
  if (denied) return denied;
  const { id } = await ctx.params;
  try {
    return Response.json({ job: toView(acknowledge(id)) });
  } catch (error) {
    return toResponse(error, "api/jamjari/ack");
  }
}
