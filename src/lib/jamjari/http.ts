// Route Handler 공통: 로컬 전용 가드, 교차 출처 요청 차단, 오류 응답.
import { ServiceError } from "./service.ts";

export function fail(status: number, code: string, message: string, details: string[] = []) {
  return Response.json({ error: { code, message, details } }, { status, headers: { "cache-control": "no-store" } });
}

/**
 * - Vercel 등 서버리스에서는 파일 저장소가 영속되지 않고 워커·kiro-cli도 없으므로 쓰기를 거부한다.
 *   읽기는 배포에 포함한 실행 결과 스냅샷(JAMJARI_DATA_DIR=demo-data/jamjarichae)만 보여준다(공개 시연판).
 * - 쓰기 요청은 사용자 정의 헤더(x-jamjari: 1)를 요구한다. 다른 사이트의 폼 전송은 이 헤더를 붙일 수 없다(CORS 사전 요청 실패).
 * - Origin 헤더가 있으면 브라우저가 보낸 Host 헤더와 같은 호스트여야 한다. `next start -H 0.0.0.0`에서는 request.url이
 *   바인딩 주소(0.0.0.0)를 담아 같은 화면에서 보낸 요청도 달라 보이므로 Host 헤더를 우선한다(2026-11-14 휴대폰 접속에서 확인).
 *   Host는 다른 사이트의 브라우저 스크립트가 바꿀 수 없다.
 */
export function guard(request: Request, write: boolean): Response | null {
  if (process.env.VERCEL && write)
    return fail(503, "public_demo", "공개 시연판은 결과 보기 전용입니다. 담기·맡기기는 개발자 PC(로컬 워커 + kiro-cli)에서만 동작합니다.");
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const host = request.headers.get("host") || new URL(request.url).host;
      if (new URL(origin).host !== host) return fail(403, "cross_origin", "다른 출처의 요청은 받지 않습니다.");
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
