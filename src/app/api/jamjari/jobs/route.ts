import { connection } from "next/server";
import { buildBriefing } from "@/domain/jamjarichae/briefing";
import { CaptureRequestSchema, LIMITS } from "@/domain/jamjarichae/contracts";
import { toView, type StoredImage } from "@/domain/jamjarichae/job";
import { listConnections } from "@/lib/jamjari/connections";
import { fail, guard, sniffImage, toResponse } from "@/lib/jamjari/http";
import { capture, OWNER } from "@/lib/jamjari/service";
import { listJobs, newId, saveUpload } from "@/lib/jamjari/store";

/** 작업 목록 + 아침 브리핑 + 연결 상태 */
export async function GET(request: Request) {
  await connection();
  const denied = guard(request, false);
  if (denied) return denied;
  try {
    const jobs = listJobs()
      .filter((j) => j.userId === OWNER)
      .map(toView);
    return Response.json(
      { jobs, briefing: buildBriefing(jobs), connections: listConnections(), now: new Date().toISOString() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return toResponse(error, "api/jamjari/jobs GET");
  }
}

/** 생각 담기(multipart/form-data: text, url, purpose, output, intent, sample, idempotencyKey, image) */
export async function POST(request: Request) {
  const denied = guard(request, true);
  if (denied) return denied;
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > LIMITS.imageBytes + 64_000) return fail(413, "too_large", "요청이 너무 큽니다(이미지 5MB 이하).");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "bad_request", "form-data 본문이 필요합니다.");
  }
  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const parsed = CaptureRequestSchema.safeParse({
    text: str("text"),
    url: str("url"),
    purpose: str("purpose"),
    output: str("output"),
    intent: str("intent") ?? "save",
    sample: str("sample") === "true",
  });
  if (!parsed.success) return fail(400, "bad_request", "목적·결과 형태 값이 올바르지 않습니다.");

  const file = form.get("image");
  let image: { name: string; type: string; size: number } | undefined;
  let stored: StoredImage | null = null;
  try {
    if (file && typeof file !== "string" && file.size > 0) {
      image = { name: file.name.slice(0, 120), type: file.type, size: file.size };
      if (file.size <= LIMITS.imageBytes && LIMITS.imageTypes.includes(file.type)) {
        const buf = Buffer.from(await file.arrayBuffer());
        const kind = sniffImage(buf);
        if (!kind) return fail(422, "invalid_capture", "담을 수 없는 조합입니다.", ["이미지 파일 내용이 PNG·JPEG·WebP가 아닙니다."]);
        stored = { storageKey: saveUpload(newId("u"), kind, buf), name: image.name, type: image.type, size: image.size };
      }
    }
    const { job, created } = capture({
      ...parsed.data,
      image,
      storedImage: stored,
      idempotencyKey: str("idempotencyKey"),
    });
    return Response.json({ job: toView(job), created }, { status: created ? 201 : 200 });
  } catch (error) {
    return toResponse(error, "api/jamjari/jobs POST");
  }
}
