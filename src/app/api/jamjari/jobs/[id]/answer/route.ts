import { z } from "zod";
import { toView } from "@/domain/jamjarichae/job";
import { fail, guard, toResponse } from "@/lib/jamjari/http";
import { answer } from "@/lib/jamjari/service";

const Body = z.object({ answer: z.string().max(2000) });

export async function POST(request: Request, ctx: RouteContext<"/api/jamjari/jobs/[id]/answer">) {
  const denied = guard(request, true);
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "bad_request", "answer 문자열이 필요합니다.");
  try {
    return Response.json({ job: toView(answer(id, parsed.data.answer)) });
  } catch (error) {
    return toResponse(error, "api/jamjari/answer");
  }
}
