// API가 쓰는 작업 조작: 담기 · 맡기기 · 답변 · 취소. 서버에서 조합을 다시 검증한다(R1.3).
import { captureDate, DEFAULT_TZ, validateCapture, type CaptureInput } from "../../domain/jamjarichae/contracts.ts";
import type { Job, StoredImage } from "../../domain/jamjarichae/job.ts";
import { createJob, deleteJobData, getJob, isTerminal, listJobs, newId, pushHistory, updateJob } from "./store.ts";

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

/** 확인 질문에 답한다(W1·W2·W6 needs_input) */
export function answer(id: string, raw: string, now = new Date()): Job {
  const text = raw.trim();
  if (!text || text.length > 1000) throw new ServiceError(422, "invalid_answer", "답변은 1–1,000자로 적어 주세요.");
  const job = mustGet(id);

  if (job.status !== "needs_input") throw new ServiceError(409, "not_waiting", "답변을 기다리는 작업이 아닙니다.");
  return updateJob(id, (j) => {
    if (j.status !== "needs_input") return false;
    j.question = { text: j.question?.text ?? "", answer: text };
    j.answers = [...(j.answers ?? []), { question: j.question.text, answer: text }].slice(-5);
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

/** 아침에 결과를 확인했다고 표시한다. 결과가 있는 끝난 작업만(답변 대기·진행 중은 불가) */
export function acknowledge(id: string, now = new Date()): Job {
  const job = mustGet(id);
  const finished = ["completed", "partial", "failed", "awaiting_external_action", "awaiting_external_confirmation"].includes(job.status);
  if (!finished || !job.result) throw new ServiceError(409, "not_finished", "결과가 나온 작업만 확인완료로 표시할 수 있습니다.");
  return updateJob(id, (j) => {
    if (j.acknowledgedAt) return false;
    j.acknowledgedAt = now.toISOString();
    pushHistory(j, "확인완료 → 전체 결과함", now);
  }) as Job;
}

/** 전체 결과함(확인완료한 작업)에서 선택한 것만 삭제한다. 확인완료 전 작업·남의 작업·없는 ID는 건너뛴다 */
export function deleteResults(ids: string[]): { deleted: string[]; skipped: string[] } {
  const deleted: string[] = [];
  const skipped: string[] = [];
  for (const id of new Set(ids)) {
    const job = getJob(id);
    if (!job || job.userId !== OWNER || !job.acknowledgedAt || !isTerminal(job.status)) {
      skipped.push(id);
      continue;
    }
    deleteJobData(job);
    deleted.push(id);
  }
  return { deleted, skipped };
}
