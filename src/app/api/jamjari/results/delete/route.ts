import { z } from "zod";
import { fail, guard, toResponse } from "@/lib/jamjari/http";
import { deleteResults } from "@/lib/jamjari/service";

const Body = z.object({ ids: z.array(z.string().max(40)).min(1).max(200) });

/** 전체 결과함에서 선택한 결과를 삭제한다(확인완료한 작업만) */
export async function POST(request: Request) {
  const denied = guard(request, true);
  if (denied) return denied;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "bad_request", "삭제할 ids 배열이 필요합니다.");
  try {
    return Response.json(deleteResults(parsed.data.ids));
  } catch (error) {
    return toResponse(error, "api/jamjari/results/delete");
  }
}
