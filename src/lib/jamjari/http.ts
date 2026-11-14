// Route Handler 공통: 로컬 전용 가드, 교차 출처 요청 차단, 오류 응답.
import { ServiceError } from "./service.ts";

export function fail(status: number, code: string, message: string, details: string[] = []) {
  return Response.json({ error: { code, message, details } }, { status, headers: { "cache-control": "no-store" } });
}

/**
 * - Vercel 등 서버리스에서는 파일 저장소가 영속되지 않으므로 거부한다(로컬·상시 서버 전용).
 * - 쓰기 요청은 사용자 정의 헤더(x-jamjari: 1)를 요구한다. 다른 사이트의 폼 전송은 이 헤더를 붙일 수 없다(CORS 사전 요청 실패).
 * - Origin 헤더가 있으면 같은 호스트여야 한다.
 */
export function guard(request: Request, write: boolean): Response | null {
  if (process.env.VERCEL) return fail(503, "local_only", "잠자리채 MVP의 야간 큐는 로컬·상시 서버에서만 동작합니다.");
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) return fail(403, "cross_origin", "다른 출처의 요청은 받지 않습니다.");
    } catch {
      return fail(403, "cross_origin", "다른 출처의 요청은 받지 않습니다.");
    }
  }
  if (write && request.headers.get("x-jamjari") !== "1") return fail(403, "missing_header", "앱 화면에서 보낸 요청만 받습니다.");
  return null;
}

export function toResponse(error: unknown, where: string): Response {
  if (error instanceof ServiceError) return fail(error.status, error.code, error.message, error.details);
  if (error instanceof Error && error.message === "lock_timeout") return fail(503, "busy", "작업이 잠시 사용 중입니다. 다시 시도해 주세요.");
  console.error(`[${where}] unexpected ${(error as Error)?.name ?? "error"}`);
  return fail(500, "internal", "서버 오류가 발생했습니다.");
}

/** PNG·JPEG·WebP 시그니처 확인 */
export function sniffImage(buf: Buffer): "png" | "jpg" | "webp" | null {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}
