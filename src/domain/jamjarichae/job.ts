// 작업(Job)과 결과(Result) 구조. Job.status는 진행 상태, Result.status는 생성된 결과의 상태다.
import type { JobStatus, ResultStatus, Step, Workflow } from "./contracts.ts";

export interface StoredImage {
  storageKey: string;
  name: string;
  type: string;
  size: number;
}

export interface JobInput {
  text: string | null;
  url: string | null;
  image: StoredImage | null;
}

export interface Source {
  id: string;
  title: string;
  url: string;
  accessedAt: string;
  publishedAt?: string | null;
  /** 워커가 실제로 URL에 접속해 응답을 받았는지(코드 판정) */
  reachable?: boolean | null;
  httpStatus?: number | null;
}

export interface ResultError {
  stage: Step | "connection";
  code: string;
  message: string;
  retryable: boolean;
}

export interface Result {
  jobId: string;
  workflow: Workflow;
  status: ResultStatus;
  title: string;
  highlights: string[];
  nextAction?: string;
  artifactType?: "html_report" | "video_file" | "web_prototype" | "calendar_event";
  artifactId?: string;
  /** 앱 안에서 여는 주소(/r/{id}, /p/{id}). 실제 저장 성공 뒤에만 채운다 */
  artifactUrl?: string;
  downloadUrl?: string;
  /** W2: 앱이 로컬에서 렌더한 MP4. 저장 성공 뒤에만 채운다 */
  videoId?: string;
  videoUrl?: string;
  videoDownloadUrl?: string;
  videoSeconds?: number;
  providerResourceId?: string;
  /** 사용자가 외부 조치 후 직접 붙여 넣은 링크(W2 영상). 앱이 생성·재생 확인하지 않음 */
  userLinkUrl?: string;
  notionPageUrl?: string;
  notionSyncStatus: "pending" | "synced" | "failed" | "not_configured";
  assumptions: string[];
  coverageNotes: string[];
  sources: Source[];
  errors: ResultError[];
  /** 생성 엔진 표시: kiro-cli(실제) / sample(샘플) */
  engine: "kiro-cli" | "sample" | "code";
}

export interface StepRecord {
  status: "running" | "done" | "skipped" | "failed";
  at: string;
  note?: string;
}

export interface Job {
  id: string;
  userId: string;
  workflow: Workflow;
  status: JobStatus;
  stage: Step | null;
  input: JobInput;
  /** 샘플 모드: 실제 외부 쓰기 금지, 결과에 샘플 배지 */
  sample: boolean;
  capturedAt: string;
  captureDate: string;
  timeZone: string;
  runAt: string | null;
  attempts: number;
  leaseUntil: string | null;
  workerId: string | null;
  idempotencyKey: string;
  steps: Partial<Record<Step, StepRecord>>;
  /** 단계별 중간 산출물. 재시작 시 여기서 이어간다(AC-03) */
  checkpoint: Record<string, unknown>;
  question: { text: string; answer: string | null } | null;
  /** 지금까지 받은 질문·답변(최근 5개). 질문이 여러 번 이어져도 앞선 답이 사라지지 않게 한다 */
  answers?: { question: string; answer: string }[];
  result: Result | null;
  history: { at: string; event: string }[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  /** 사용자가 "확인완료"를 누른 시각. 있으면 아침 화면에서 빠지고 전체 결과함에 쌓인다 */
  acknowledgedAt?: string | null;
  /** 화면 정리용: true면 목록·브리핑에서 숨긴다(파일은 지우지 않음) */
  hidden?: boolean;
}

/** 생성 엔진과 코드 판정에 넘길 답변 묶음. 답이 없으면 null */
export function answersText(job: Pick<Job, "answers" | "question">): string | null {
  if (job.answers?.length) return job.answers.map((a) => `질문: ${a.question}\n답: ${a.answer}`).join("\n\n");
  return job.question?.answer ?? null;
}

/** 화면에 내려보낼 공개 형태(체크포인트 원문·내부 필드 제외) */
export type JobView = Omit<Job, "checkpoint" | "workerId" | "idempotencyKey">;

export function toView(job: Job): JobView {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { checkpoint, workerId, idempotencyKey, ...rest } = job;
  return rest;
}
