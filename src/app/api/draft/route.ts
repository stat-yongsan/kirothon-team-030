import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { currentDomain } from "@/domain/current";
import { generateDraft } from "@/lib/ai";
import { getAiConfig } from "@/lib/ai/config";
import { AiError } from "@/lib/ai/errors";

// Claude 호출 상한: SDK timeout 50초 × (재시도 1회 + 1)
export const maxDuration = 120;

const MAX_INPUT_CHARS = 100_000;
const MAX_EVIDENCE = 300;

const RequestSchema = z.object({ input: z.string() });

function fail(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

/**
 * 유료 live 호출 보호. 프로덕션(next start·Vercel)에서는 DRAFT_ACCESS_CODE가 없으면 막고(fail-closed),
 * 설정돼 있으면 요청 헤더 x-access-code가 일치해야 한다. 로컬 개발(next dev)에서는 코드 없이 허용.
 * ponytail: 호출량 상한은 앱 메모리 카운터 대신 Anthropic Console 지출 한도로 건다(서버리스 인스턴스 간 공유 불가).
 */
function deniedLiveAccess(request: Request): Response | null {
  const expected = process.env.DRAFT_ACCESS_CODE?.trim();
  if (!expected) {
    return process.env.NODE_ENV === "production"
      ? fail(503, "config", "배포 환경에서 live 모드를 쓰려면 DRAFT_ACCESS_CODE를 설정하세요.")
      : null;
  }
  const digest = (s: string) => createHash("sha256").update(s).digest();
  const given = request.headers.get("x-access-code") ?? "";
  return timingSafeEqual(digest(given), digest(expected))
    ? null
    : fail(401, "access_denied", "접근 코드가 필요하거나 맞지 않습니다.");
}

export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_INPUT_CHARS * 4) return fail(413, "too_large", "입력이 너무 큽니다 (최대 100,000자).");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_request", "JSON 본문이 필요합니다.");
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return fail(400, "bad_request", "input 문자열이 필요합니다.");
  const input = parsed.data.input;
  if (input.trim() === "") return fail(400, "bad_request", "입력이 비어 있습니다.");
  if (input.length > MAX_INPUT_CHARS) return fail(413, "too_large", "입력이 너무 큽니다 (최대 100,000자).");

  // 클라이언트가 보낸 집계를 믿지 않고 서버에서 다시 계산한다.
  const analysis = currentDomain.analyze(input);
  if (!analysis.canDraft) {
    const errors = analysis.issues.filter((i) => i.severity === "error").length;
    return fail(422, "input_invalid", `입력 오류 ${errors}건을 먼저 고쳐야 합니다.`);
  }
  if (analysis.evidence.length > MAX_EVIDENCE) {
    return fail(413, "too_large", `근거 항목이 너무 많습니다 (최대 ${MAX_EVIDENCE}개). 행 수를 줄이세요.`);
  }

  try {
    if (getAiConfig().mode === "live") {
      const denied = deniedLiveAccess(request);
      if (denied) return denied;
    }
    const result = await generateDraft(currentDomain, analysis);
    return Response.json({ ...result, domain: currentDomain.id });
  } catch (error) {
    if (error instanceof AiError) {
      // 입력 원문·비밀값은 로그에 남기지 않는다.
      console.error(`[api/draft] ${error.code} (${error.status})`);
      return fail(error.status, error.code, error.message);
    }
    console.error("[api/draft] unexpected error");
    return fail(500, "internal", "서버 오류가 발생했습니다.");
  }
}
