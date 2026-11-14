// 잠자리채 공통 계약: 여섯 경로, 입력 조합 검증, 상태, 입력 날짜.
// 서버(API·워커)와 화면이 같은 표로 검증한다. 워커가 Node에서 직접 실행하므로 상대 경로 + .ts 확장자로 import한다.
import { z } from "zod";

export const PURPOSES = ["concept", "idea", "summary", "schedule"] as const;
export type Purpose = (typeof PURPOSES)[number];

export const OUTPUTS = ["html", "video", "prototype", "calendar"] as const;
export type OutputKind = (typeof OUTPUTS)[number];

export const WORKFLOW_IDS = [
  "concept_report",
  "concept_video",
  "idea_report",
  "idea_prototype",
  "url_summary",
  "calendar_event",
] as const;
export type Workflow = (typeof WORKFLOW_IDS)[number];

export type InputKind = "text" | "url" | "image";

export interface WorkflowSpec {
  code: "W1" | "W2" | "W3" | "W4" | "W5" | "W6";
  id: Workflow;
  purpose: Purpose;
  output: OutputKind;
  /** 화면 표시용 결과 형태 */
  outputLabel: string;
  /** 허용 입력 종류 */
  allowed: InputKind[];
  /** 반드시 있어야 하는 입력(없으면 allowed 중 1개 이상) */
  required?: InputKind[];
  /** URL 정확히 1개만 허용(W5) */
  urlOnly?: boolean;
  artifactType: "html_report" | "video_file" | "web_prototype" | "calendar_event";
  notionSection: string;
}

export const PURPOSE_LABEL: Record<Purpose, string> = {
  concept: "개념알기",
  idea: "아이디어확대",
  summary: "요약",
  schedule: "일정잡기",
};

export const WORKFLOWS: readonly WorkflowSpec[] = [
  {
    code: "W1",
    id: "concept_report",
    purpose: "concept",
    output: "html",
    outputLabel: "HTML 보고서",
    allowed: ["text", "url", "image"],
    artifactType: "html_report",
    notionSection: "01 개념알기·HTML",
  },
  {
    code: "W2",
    id: "concept_video",
    purpose: "concept",
    output: "video",
    outputLabel: "영상(MP4)",
    allowed: ["text", "url", "image"],
    artifactType: "video_file",
    notionSection: "02 개념알기·영상",
  },
  {
    code: "W3",
    id: "idea_report",
    purpose: "idea",
    output: "html",
    outputLabel: "아이디어 5개 HTML",
    allowed: ["text"],
    required: ["text"],
    artifactType: "html_report",
    notionSection: "03 아이디어·HTML",
  },
  {
    code: "W4",
    id: "idea_prototype",
    purpose: "idea",
    output: "prototype",
    outputLabel: "원페이지 체험 URL",
    allowed: ["text"],
    required: ["text"],
    artifactType: "web_prototype",
    notionSection: "04 아이디어·체험",
  },
  {
    code: "W5",
    id: "url_summary",
    purpose: "summary",
    output: "html",
    outputLabel: "요약 HTML",
    allowed: ["url"],
    required: ["url"],
    urlOnly: true,
    artifactType: "html_report",
    notionSection: "05 요약·HTML",
  },
  {
    code: "W6",
    id: "calendar_event",
    purpose: "schedule",
    output: "calendar",
    outputLabel: "Google Calendar 일정 URL",
    allowed: ["text", "url", "image"],
    artifactType: "calendar_event",
    notionSection: "06 일정·URL",
  },
];

export function outputsFor(purpose: Purpose): WorkflowSpec[] {
  return WORKFLOWS.filter((w) => w.purpose === purpose);
}

export function resolveWorkflow(purpose: Purpose, output: OutputKind): WorkflowSpec | null {
  return WORKFLOWS.find((w) => w.purpose === purpose && w.output === output) ?? null;
}

export function workflowSpec(id: Workflow): WorkflowSpec {
  const spec = WORKFLOWS.find((w) => w.id === id);
  if (!spec) throw new Error(`unknown workflow ${id}`);
  return spec;
}

// ---- 입력 ----

export const LIMITS = {
  textChars: 5_000,
  urlChars: 2_048,
  imageBytes: 5 * 1024 * 1024,
  imageTypes: ["image/png", "image/jpeg", "image/webp"] as readonly string[],
};

export interface CaptureInput {
  text?: string;
  url?: string;
  image?: { name: string; type: string; size: number };
  purpose: Purpose;
  output: OutputKind;
}

export interface CaptureCheck {
  ok: boolean;
  workflow: WorkflowSpec | null;
  errors: string[];
  /** 저장할 정규화된 값 */
  normalized: { text: string | null; url: string | null };
}

export function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (u.protocol === "http:" || u.protocol === "https:") && Boolean(u.hostname);
  } catch {
    return false;
  }
}

/** 입력·목적·결과 조합을 검증한다. 화면과 서버가 같은 함수를 쓴다(AC-01). */
export function validateCapture(input: CaptureInput): CaptureCheck {
  const errors: string[] = [];
  const text = input.text?.trim() ? input.text.trim() : null;
  const url = input.url?.trim() ? input.url.trim() : null;
  const image = input.image ?? null;

  const workflow = resolveWorkflow(input.purpose, input.output);
  if (!workflow) {
    const allowed = outputsFor(input.purpose)
      .map((w) => w.outputLabel)
      .join(" / ");
    errors.push(`${PURPOSE_LABEL[input.purpose]}에서는 ${allowed}만 고를 수 있습니다.`);
    return { ok: false, workflow: null, errors, normalized: { text, url } };
  }

  if (text && text.length > LIMITS.textChars) errors.push(`메모는 ${LIMITS.textChars.toLocaleString()}자까지 담을 수 있습니다.`);
  if (url) {
    if (url.length > LIMITS.urlChars) errors.push("URL이 너무 깁니다.");
    else if (!isHttpUrl(url)) errors.push("URL은 http:// 또는 https://로 시작해야 합니다.");
  }
  if (image) {
    if (!LIMITS.imageTypes.includes(image.type)) errors.push("이미지는 PNG·JPEG·WebP만 담을 수 있습니다.");
    if (image.size > LIMITS.imageBytes) errors.push("이미지는 5MB까지 담을 수 있습니다.");
  }

  const present: InputKind[] = [];
  if (text) present.push("text");
  if (url) present.push("url");
  if (image) present.push("image");

  const notAllowed = present.filter((k) => !workflow.allowed.includes(k));
  const KIND_LABEL: Record<InputKind, string> = { text: "메모", url: "URL", image: "이미지" };
  if (notAllowed.length > 0) {
    errors.push(
      `${PURPOSE_LABEL[workflow.purpose]}·${workflow.outputLabel}은(는) ${workflow.allowed
        .map((k) => KIND_LABEL[k])
        .join("·")}만 받습니다. ${notAllowed.map((k) => KIND_LABEL[k]).join("·")}을(를) 빼 주세요.`,
    );
  }
  const required = workflow.required ?? [];
  const missingRequired = required.filter((k) => !present.includes(k));
  if (missingRequired.length > 0) {
    errors.push(`${workflow.outputLabel}에는 ${missingRequired.map((k) => KIND_LABEL[k]).join("·")}이(가) 필요합니다.`);
  } else if (present.length === 0) {
    errors.push("메모, URL, 이미지 중 하나 이상을 담아 주세요.");
  }

  return { ok: errors.length === 0, workflow, errors, normalized: { text, url } };
}

export const CaptureRequestSchema = z.object({
  text: z.string().max(LIMITS.textChars * 2).optional(),
  url: z.string().max(LIMITS.urlChars * 2).optional(),
  purpose: z.enum(PURPOSES),
  output: z.enum(OUTPUTS),
  /** "save" = 생각 담기(저장만), "queue" = 바로 큐에 넣기 */
  intent: z.enum(["save", "queue"]).default("save"),
  sample: z.boolean().optional(),
});

// ---- 상태 ----

export const JOB_STATUSES = [
  "draft",
  "queued",
  "scheduled",
  "running",
  "needs_input",
  "awaiting_external_action",
  "awaiting_external_confirmation",
  "completed",
  "partial",
  "failed",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  draft: "저장됨",
  queued: "대기",
  scheduled: "예약됨",
  running: "잠든 사이, 정리 중",
  needs_input: "내 답변 필요",
  awaiting_external_action: "외부 조치 필요",
  awaiting_external_confirmation: "외부 확인 대기",
  completed: "완료",
  partial: "부분 완료",
  failed: "실패",
  cancelled: "취소됨",
};

export const STEPS = ["ingest", "research", "generate", "verify", "store_artifact", "render_video", "sync_notion", "external_action"] as const;
export type Step = (typeof STEPS)[number];

export const STEP_LABEL: Record<Step, string> = {
  ingest: "자료 읽는 중",
  research: "조사 중",
  generate: "만드는 중",
  verify: "확인 중",
  store_artifact: "결과 저장",
  render_video: "영상 만드는 중",
  sync_notion: "Notion 기록",
  external_action: "외부 연결",
};

export type ResultStatus = "completed" | "partial" | "needs_input" | "failed";

/** 워커가 다시 손대지 않는 최종 상태 */
export const TERMINAL: readonly JobStatus[] = ["completed", "partial", "failed", "cancelled"];

/** 기본 재시도 2회(총 3번 시도). 인증·모호한 입력·외부 확인은 자동 재시도하지 않는다. */
export const MAX_ATTEMPTS = 3;

// ---- 날짜 ----

export const DEFAULT_TZ = "Asia/Seoul";

/** 입력을 받은 사용자의 현지 날짜(YYYY-MM-DD). Notion 날짜 페이지 기준(AC-17). */
export function captureDate(at: Date, timeZone: string = DEFAULT_TZ): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
