import { toView } from "@/domain/jamjarichae/job";
import { guard, toResponse } from "@/lib/jamjari/http";
import { cancel } from "@/lib/jamjari/service";

export async function POST(request: Request, ctx: RouteContext<"/api/jamjari/jobs/[id]/cancel">) {
  const denied = guard(request, true);
  if (denied) return denied;
  const { id } = await ctx.params;
  try {
    return Response.json({ job: toView(cancel(id)) });
  } catch (error) {
    return toResponse(error, "api/jamjari/cancel");
  }
}
