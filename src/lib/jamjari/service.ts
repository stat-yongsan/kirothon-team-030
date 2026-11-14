// API가 쓰는 작업 조작: 담기 · 맡기기 · 답변 · 취소. 서버에서 조합을 다시 검증한다(R1.3).
import { captureDate, DEFAULT_TZ, isHttpUrl, validateCapture, type CaptureInput } from "../../domain/jamjarichae/contracts.ts";
import type { Job, StoredImage } from "../../domain/jamjarichae/job.ts";
import { createJob, getJob, isTerminal, listJobs, newId, pushHistory, updateJob } from "./store.ts";

export const OWNER = "owner";

export class ServiceError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: string[];
  constructor(status: number, code: string, message: string, details: string[] = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface CaptureRequest extends CaptureInput {
  intent: "save" | "queue";
  sample?: boolean;
  idempotencyKey?: string;
  storedImage?: StoredImage | null;
}

export function capture(req: CaptureRequest, now = new Date()): { job: Job; created: boolean } {
  const check = validateCapture(req);
  if (!check.ok || !check.workflow) throw new ServiceError(422, "invalid_capture", "담을 수 없는 조합입니다.", check.errors);
  const at = now.toISOString();
  const key = req.idempotencyKey && /^[\w-]{8,64}$/.test(req.idempotencyKey) ? req.idempotencyKey : newId("j");
  const job: Job = {
    id: newId("j"),
    userId: OWNER,
    workflow: check.workflow.id,
    status: req.intent === "queue" ? "queued" : "draft",
    stage: null,
    input: { text: check.normalized.text, url: check.normalized.url, image: req.storedImage ?? null },
    sample: Boolean(req.sample),
    capturedAt: at,
    captureDate: captureDate(now, DEFAULT_TZ),
    timeZone: DEFAULT_TZ,
    runAt: null,
    attempts: 0,
    leaseUntil: null,
    workerId: null,
    idempotencyKey: key,
    steps: {},
    checkpoint: {},
    question: null,
    result: null,
    history: [{ at, event: req.intent === "queue" ? "담고 바로 맡김" : "생각 담기" }],
    createdAt: at,
    updatedAt: at,
    completedAt: null,
  };
  return createJob(job);
}

/** 잠자리채에 맡기기: 저장된 draft를 모두(또는 지정한 것만) queued로 */
export function entrust(ids?: string[], now = new Date()): string[] {
  const targets = listJobs().filter((j) => j.status === "draft" && (!ids || ids.includes(j.id)));
  const moved: string[] = [];
  for (const t of targets) {
    const j = updateJob(t.id, (job) => {
      if (job.status !== "draft") return false;
      job.status = "queued";
      pushHistory(job, "잠자리채에 맡김", now);
    });
    if (j?.status === "queued") moved.push(j.id);
  }
  return moved;
}

function mustGet(id: string): Job {
  const job = getJob(id);
  if (!job || job.userId !== OWNER) throw new ServiceError(404, "not_found", "작업을 찾을 수 없습니다.");
  return job;
}

/** 확인 질문에 답하거나(W1·W6 needs_input), W2 외부 조치 결과(영상 링크)를 넣는다 */
export function answer(id: string, raw: string, now = new Date()): Job {
  const text = raw.trim();
  if (!text || text.length > 1000) throw new ServiceError(422, "invalid_answer", "답변은 1–1,000자로 적어 주세요.");
  const job = mustGet(id);

  if (job.status === "awaiting_external_action" && job.workflow === "concept_video") {
    if (!isHttpUrl(text)) throw new ServiceError(422, "invalid_answer", "http:// 또는 https:// 영상 링크를 붙여 넣어 주세요.");
    return updateJob(id, (j) => {
      if (!j.result) return false;
      j.result.artifactType = "notebook_video";
      j.result.providerResourceId = undefined;
      j.result.coverageNotes.push(`영상 링크는 사용자가 직접 입력했습니다(${now.toISOString().slice(0, 16)}Z). 앱이 생성하거나 재생을 확인하지 않았습니다.`);
      j.result.highlights = [...j.result.highlights.slice(0, 2), "사용자가 입력한 영상 링크 연결됨"];
      j.result.userLinkUrl = text;
      j.question = j.question ? { ...j.question, answer: text } : null;
      j.status = "partial";
      pushHistory(j, "외부 조치 완료(사용자 입력 영상 링크)", now);
    }) as Job;
  }

  if (job.status !== "needs_input") throw new ServiceError(409, "not_waiting", "답변을 기다리는 작업이 아닙니다.");
  return updateJob(id, (j) => {
    if (j.status !== "needs_input") return false;
    j.question = { text: j.question?.text ?? "", answer: text };
    // 입력 수집 이후 단계부터 다시(답이 해석을 바꾸므로)
    const ingest = j.checkpoint.ingest;
    const ingestStep = j.steps.ingest;
    j.checkpoint = ingest === undefined ? {} : { ingest };
    j.steps = ingestStep ? { ingest: ingestStep } : {};
    j.result = null;
    j.attempts = 0;
    j.status = "queued";
    pushHistory(j, "내 답변 저장 → 다시 맡김", now);
  }) as Job;
}

export function cancel(id: string, now = new Date()): Job {
  const job = mustGet(id);
  if (isTerminal(job.status)) throw new ServiceError(409, "already_done", "이미 끝난 작업은 취소할 수 없습니다.");
  return updateJob(id, (j) => {
    if (isTerminal(j.status)) return false;
    const wasRunning = j.status === "running";
    j.status = "cancelled";
    j.leaseUntil = null;
    pushHistory(j, wasRunning ? "취소(다음 단계 경계에서 멈춤, 만든 외부 자원은 삭제하지 않음)" : "취소", now);
  }) as Job;
}
