// 야간 워커의 작업 실행. 단계마다 체크포인트를 저장해 재시작하면 끝난 단계를 다시 실행하지 않는다(AC-03).
import fs from "node:fs";
import path from "node:path";
import { MAX_ATTEMPTS, workflowSpec, type JobStatus, type ResultStatus, type Step } from "../../domain/jamjarichae/contracts.ts";
import * as F from "../../domain/jamjarichae/fixtures.ts";
import { answersText, type Job, type Result, type Source } from "../../domain/jamjarichae/job.ts";
import {
  checkIdeas,
  checkPrototypeHtml,
  ConceptResearchSchema,
  extractJson,
  IdeaReportSchema,
  PrototypeSchema,
  SummarySchema,
  type ConceptResearch,
  type IdeaReport,
  type Prototype,
  type Summary,
} from "../../domain/jamjarichae/outputs.ts";
import { buildComposition, planVideo } from "../../domain/jamjarichae/video.ts";
import { conceptBody, ideaBody, scheduleBody, shell, summaryBody } from "../../domain/jamjarichae/render.ts";
import { decideSchedule, ScheduleExtractionSchema, verifyYearStated, type ScheduleDecision, type ScheduleExtraction } from "../../domain/jamjarichae/schedule.ts";
import { captureDate } from "../../domain/jamjarichae/contracts.ts";
import { notionConfigured } from "./connections.ts";
import { fetchPublicPage, probeUrl, UrlBlockedError, type FetchedPage } from "./fetch-url.ts";
import { WEB_TOOLS, type KiroRunner } from "./kiro.ts";
import * as P from "./prompts.ts";
import { getJob, newId, pushHistory, sandboxFor, saveArtifact, updateJob } from "./store.ts";
import * as YT from "./youtube.ts";
import { renderWithHyperframes, type VideoRenderer } from "./video-render.ts";
import type { z } from "zod";

export interface WorkerDeps {
  kiro: KiroRunner;
  fetchPage: (url: string) => Promise<FetchedPage>;
  probe: (url: string) => Promise<{ reachable: boolean; status: number | null }>;
  youtube: Pick<typeof YT, "fetchMeta" | "fetchTranscript" | "captureFrames">;
  video: VideoRenderer;
  now: () => Date;
  env: Record<string, string | undefined>;
  kiroTimeoutMs: number;
  leaseMs: number;
}

export function defaultDeps(kiro: KiroRunner): WorkerDeps {
  return {
    kiro,
    fetchPage: (u) => fetchPublicPage(u),
    probe: (u) => probeUrl(u),
    youtube: YT,
    video: renderWithHyperframes(),
    now: () => new Date(),
    env: process.env,
    kiroTimeoutMs: Number(process.env.JAMJARI_KIRO_TIMEOUT_MS) || 6 * 60_000,
    // 심장박동이 5초마다 연장한다. 워커가 죽으면 60초 뒤 다른 워커가 재점유한다
    leaseMs: 60_000,
  };
}

export class StepError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly stage: Step;
  readonly nextAction?: string;
  constructor(stage: Step, code: string, message: string, retryable: boolean, nextAction?: string) {
    super(message);
    this.stage = stage;
    this.code = code;
    this.retryable = retryable;
    this.nextAction = nextAction;
  }
}

class Cancelled extends Error {}

interface Outcome {
  status: JobStatus;
  result: Result;
  question?: string | null;
}

// ---- 단계 실행 ----

async function step<T>(id: string, name: Step, deps: WorkerDeps, fn: () => Promise<T>): Promise<T> {
  const cur = getJob(id);
  if (!cur || cur.status === "cancelled") throw new Cancelled();
  if (cur.steps[name]?.status === "done" && name in cur.checkpoint) return cur.checkpoint[name] as T;
  const now = deps.now();
  updateJob(id, (j) => {
    if (j.status === "cancelled") return false;
    j.stage = name;
    j.steps[name] = { status: "running", at: now.toISOString() };
    j.leaseUntil = new Date(now.getTime() + deps.leaseMs).toISOString();
  });
  const value = await fn();
  updateJob(id, (j) => {
    j.steps[name] = { status: "done", at: deps.now().toISOString() };
    j.checkpoint[name] = value as unknown;
  });
  return value;
}

async function askKiro<S extends z.ZodTypeAny>(
  job: Job,
  stage: Step,
  prompt: string,
  schema: S,
  tools: string[],
  deps: WorkerDeps,
): Promise<z.infer<S>> {
  const run = await deps.kiro(prompt, { tools, timeoutMs: deps.kiroTimeoutMs, cwd: sandboxFor(job.id) });
  if (run.timedOut) throw new StepError(stage, "timeout", `kiro-cli가 ${Math.round(deps.kiroTimeoutMs / 1000)}초 안에 끝나지 않았습니다.`, true);
  if (run.exitCode !== 0) {
    throw new StepError(stage, run.exitCode === null ? "engine_missing" : "engine_error", run.exitCode === null ? "kiro-cli를 실행하지 못했습니다." : `kiro-cli 종료 코드 ${run.exitCode}`, run.exitCode !== null);
  }
  let json: unknown;
  try {
    json = extractJson(run.stdout);
  } catch {
    throw new StepError(stage, "invalid_output", "Kiro 응답에서 JSON을 찾지 못했습니다.", true);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    // 값은 빼고 어느 필드가 계약을 어겼는지만 남긴다(원인 조사용)
    const where = [...new Set(parsed.error.issues.map((i) => `${i.path.map(String).join(".") || "(root)"}:${i.code}`))].slice(0, 5).join(", ");
    throw new StepError(stage, "invalid_output", `Kiro 응답 형식이 계약과 다릅니다(${parsed.error.issues.length}곳: ${where}).`, true);
  }
  return parsed.data;
}

/** 샘플 작업은 고정 데이터를 같은 스키마로 검증해 쓴다 */
function sampleOr<T>(job: Job, sample: T, real: () => Promise<T>): Promise<T> {
  return job.sample ? Promise.resolve(structuredClone(sample)) : real();
}

function baseResult(job: Job, title: string): Result {
  const spec = workflowSpec(job.workflow);
  return {
    jobId: job.id,
    workflow: job.workflow,
    status: "completed",
    title,
    highlights: [],
    artifactType: spec.artifactType,
    notionSyncStatus: "pending",
    assumptions: [],
    coverageNotes: [],
    sources: [],
    errors: [],
    engine: job.sample ? "sample" : "kiro-cli",
  };
}

function storeReport(job: Job, result: Result, status: JobStatus, body: string, deps: WorkerDeps): { artifactId: string } {
  const artifactId = newId("a");
  const html = shell(
    {
      title: result.title,
      workflow: job.workflow,
      status,
      sample: job.sample,
      engine: job.sample ? "샘플(고정 데이터)" : "kiro-cli headless",
      captureDate: job.captureDate,
      generatedAt: deps.now().toISOString(),
      input: { text: job.input.text, url: job.input.url, hasImage: Boolean(job.input.image) },
      highlights: result.highlights,
      nextAction: result.nextAction,
      assumptions: result.assumptions,
      coverageNotes: result.coverageNotes,
      sources: result.sources,
    },
    body,
  );
  saveArtifact(artifactId, html, "html");
  return { artifactId };
}

function attachReport(result: Result, artifactId: string) {
  result.artifactId = artifactId;
  result.artifactUrl = `/r/${artifactId}`;
  result.downloadUrl = `/r/${artifactId}?download=1`;
}

/** 결과는 앱에 먼저 보관하고 Notion은 별도 단계로 기록한다(AC-16). 이번 버전은 연결이 없으면 not_configured */
async function syncNotion(job: Job, result: Result, deps: WorkerDeps): Promise<void> {
  const r = await step(job.id, "sync_notion", deps, async () => {
    if (job.sample) return { status: "not_configured" as const, note: "샘플 모드: Notion에 쓰지 않음" };
    if (!notionConfigured(deps.env)) return { status: "not_configured" as const, note: "Notion 연결 없음: 결과는 앱에만 보관" };
    return { status: "failed" as const, note: "Notion 동기화 어댑터는 이번 버전에 실연동 검증 전이라 실행하지 않았습니다." };
  });
  result.notionSyncStatus = r.status;
  result.coverageNotes.push(r.note);
}

// ---- 입력 수집 ----

interface Ingest {
  fetched: { url: string; title: string | null; text: string; truncated: boolean } | null;
  notes: string[];
}

async function ingest(job: Job, deps: WorkerDeps): Promise<Ingest> {
  return step(job.id, "ingest", deps, async () => {
    const notes: string[] = [];
    let fetched: Ingest["fetched"] = null;
    if (job.input.url) {
      if (job.sample) notes.push("샘플 모드: URL에 접속하지 않음");
      else {
        try {
          const page = await deps.fetchPage(job.input.url);
          fetched = { url: page.finalUrl, title: page.title, text: page.text, truncated: page.truncated };
          notes.push(`URL 본문 ${page.text.length.toLocaleString()}자를 읽었습니다${page.truncated ? "(상한에서 잘림)" : ""}.`);
        } catch (error) {
          const msg = error instanceof UrlBlockedError ? error.message : "페이지를 읽지 못했습니다.";
          notes.push(`URL을 읽지 못함: ${msg}`);
        }
      }
    }
    if (job.input.image) notes.push("이미지 내용 분석은 이번 버전에 연결되지 않았습니다. 이미지는 저장만 했습니다.");
    return { fetched, notes };
  });
}

function requireReadable(job: Job, ing: Ingest) {
  if (!job.input.text && !ing.fetched && !(job.sample && job.input.url)) {
    throw new StepError(
      "ingest",
      "no_readable_input",
      "읽을 수 있는 입력이 없습니다(이미지 분석 미연결 또는 URL 읽기 실패).",
      false,
      "핵심 내용을 메모로 적거나 다른 링크로 다시 담아 주세요.",
    );
  }
}

function ctxOf(job: Job, ing: Ingest, deps: WorkerDeps): P.PromptContext {
  return {
    input: job.input,
    fetched: ing.fetched,
    answer: answersText(job),
    today: captureDate(deps.now(), job.timeZone),
    timeZone: job.timeZone,
  };
}

// ---- W1/W2 개념 조사 ----

async function research(job: Job, ing: Ingest, deps: WorkerDeps): Promise<{ research: ConceptResearch; sources: Source[]; notes: string[] }> {
  const r = await step(job.id, "research", deps, () =>
    sampleOr(job, F.SAMPLE_CONCEPT, () => askKiro(job, "research", P.conceptPrompt(ctxOf(job, ing, deps)), ConceptResearchSchema, WEB_TOOLS, deps)),
  );
  if (r.ambiguity.blockingQuestion) return { research: r, sources: [], notes: [] };
  const verified = await step(job.id, "verify", deps, async () => {
    const at = deps.now().toISOString();
    const notes: string[] = [];
    const sources: Source[] = [];
    for (const s of r.sources) {
      const probe = job.sample ? { reachable: null, status: null } : await deps.probe(s.url);
      sources.push({ id: s.id, title: s.title, url: s.url, publishedAt: s.publishedAt ?? null, accessedAt: at, reachable: probe.reachable, httpStatus: probe.status });
    }
    const ids = new Set(sources.map((s) => s.id));
    const refs = [...r.history.flatMap((h) => h.sourceIds), ...r.recentResearch.map((p) => p.sourceId)];
    const dangling = [...new Set(refs.filter((x) => !ids.has(x)))];
    if (dangling.length) notes.push(`출처 목록에 없는 근거 ID ${dangling.join(", ")}가 있어 확인되지 않은 근거로 표시합니다.`);
    const ok = sources.filter((s) => s.reachable).length;
    if (!job.sample) notes.push(`출처 ${sources.length}개 중 ${ok}개가 접속 시 응답했습니다(코드 확인).`);
    return { sources, notes };
  });
  return { research: r, ...verified };
}

async function runConcept(job: Job, deps: WorkerDeps): Promise<Outcome> {
  const ing = await ingest(job, deps);
  requireReadable(job, ing);
  const { research: r, sources, notes } = await research(job, ing, deps);
  const result = baseResult(job, r.term);
  if (r.ambiguity.blockingQuestion) {
    result.status = "needs_input";
    result.highlights = [`"${r.term}"의 뜻을 정해야 조사할 수 있습니다.`];
    result.assumptions = r.ambiguity.meanings.map((m) => `가능한 뜻: ${m}`);
    return { status: "needs_input", result, question: r.ambiguity.blockingQuestion };
  }
  result.highlights = r.highlights;
  result.nextAction = r.nextAction;
  result.sources = sources;
  result.assumptions = r.ambiguity.chosenInterpretation ? [r.ambiguity.chosenInterpretation] : [];
  result.coverageNotes = [...ing.notes, ...notes, `검색 범위: ${r.searchScope}`];
  if (!job.sample && !sources.some((s) => s.reachable)) {
    result.status = "partial";
    result.coverageNotes.push("응답이 확인된 출처가 없어 부분 완료로 둡니다.");
  }

  if (job.workflow === "concept_report") {
    const { artifactId } = await step(job.id, "store_artifact", deps, async () => storeReport(job, result, result.status, conceptBody(r), deps));
    attachReport(result, artifactId);
    await syncNotion(job, result, deps);
    return { status: result.status === "partial" ? "partial" : "completed", result };
  }

  const { artifactId } = await step(job.id, "store_artifact", deps, async () => storeReport(job, result, result.status, conceptBody(r), deps));
  attachReport(result, artifactId);

  if (job.workflow === "concept_video") await attachVideo(job, r, result, deps);

  await syncNotion(job, result, deps);
  return { status: result.status === "partial" ? "partial" : "completed", result };
}

/** W2: 조사 결과로 장면을 짜고 로컬에서 MP4를 렌더한다(HyperFrames). 실패해도 보고서는 남기고 부분 완료로 표시한다 */
async function attachVideo(job: Job, r: ConceptResearch, result: Result, deps: WorkerDeps): Promise<void> {
  const plan = planVideo(r, { sample: job.sample });
  const out = await step(job.id, "render_video", deps, async () => {
    const dir = path.join(sandboxFor(job.id), "video");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), buildComposition(plan), "utf8");
    const done = await deps.video(dir);
    if (!done.ok || !done.file) return { ok: false as const, code: done.code ?? "render_error", message: done.message ?? "영상 렌더에 실패했습니다." };
    const videoId = newId("a");
    saveArtifact(videoId, fs.readFileSync(done.file), "mp4");
    return { ok: true as const, videoId };
  });
  if (!out.ok) {
    result.status = "partial";
    result.nextAction = "영상은 만들지 못했습니다. 아래 보고서를 먼저 확인하고, 같은 생각을 다시 맡겨 주세요.";
    result.errors.push({ stage: "render_video", code: out.code, message: out.message, retryable: true });
    result.coverageNotes.push(`영상 렌더 실패(${out.code}): ${out.message}`);
    return;
  }
  result.artifactType = "video_file";
  result.videoId = out.videoId;
  result.videoUrl = `/v/${out.videoId}`;
  result.videoDownloadUrl = `/v/${out.videoId}?download=1`;
  result.videoSeconds = plan.totalSec;
  result.title = `${r.term} — 영상`;
  result.coverageNotes.push(
    `영상: 장면 ${plan.scenes.length}개 · 약 ${Math.round(plan.totalSec)}초 · 내레이션·음악 없는 자막형 영상(HyperFrames 로컬 렌더).${job.sample ? " 샘플 자료로 만들었습니다." : ""}`,
  );
}

// ---- W3 아이디어 5개 ----

async function runIdeas(job: Job, deps: WorkerDeps): Promise<Outcome> {
  const ing = await ingest(job, deps);
  requireReadable(job, ing);
  const out = await step(job.id, "generate", deps, async () => {
    let report: IdeaReport = await sampleOr(job, F.SAMPLE_IDEAS, () => askKiro(job, "generate", P.ideaPrompt(ctxOf(job, ing, deps)), IdeaReportSchema, [], deps));
    let problems = checkIdeas(report);
    if (problems.length && !job.sample) {
      report = await askKiro(job, "generate", P.ideaPrompt(ctxOf(job, ing, deps), problems), IdeaReportSchema, [], deps);
      problems = checkIdeas(report);
    }
    return { report, problems };
  });
  const result = baseResult(job, `아이디어 확장: ${out.report.seed.slice(0, 60)}`);
  result.highlights = out.report.highlights;
  result.nextAction = out.report.nextAction;
  result.coverageNotes = [...ing.notes, "jwynia/agent-skills brainstorming(커밋 99a8797)의 Escape Velocity 절차를 앱용으로 적용. 무작위 제약 스크립트(constraint-entropy.ts)는 실행하지 않았습니다."];
  if (out.problems.length) {
    result.status = "partial";
    result.coverageNotes.push(...out.problems.map((p) => `코드 검사: ${p}`));
  } else result.coverageNotes.push("코드 검사: 아이디어 5개, 이름 중복 없음, 각 2개 축 이상 변경 — 통과");
  const { artifactId } = await step(job.id, "store_artifact", deps, async () => storeReport(job, result, result.status === "partial" ? "partial" : "completed", ideaBody(out.report), deps));
  attachReport(result, artifactId);
  await syncNotion(job, result, deps);
  return { status: result.status === "partial" ? "partial" : "completed", result };
}

// ---- W4 원페이지 체험 ----

async function runPrototype(job: Job, deps: WorkerDeps): Promise<Outcome> {
  const ing = await ingest(job, deps);
  requireReadable(job, ing);
  const out = await step(job.id, "generate", deps, async () => {
    let proto: Prototype = await sampleOr(job, F.SAMPLE_PROTOTYPE, () => askKiro(job, "generate", P.prototypePrompt(ctxOf(job, ing, deps)), PrototypeSchema, [], deps));
    let problems = checkPrototypeHtml(proto.html);
    if (problems.length && !job.sample) {
      proto = await askKiro(job, "generate", P.prototypePrompt(ctxOf(job, ing, deps), problems), PrototypeSchema, [], deps);
      problems = checkPrototypeHtml(proto.html);
    }
    return { proto, problems };
  });
  if (out.problems.length) {
    throw new StepError("verify", "unsafe_prototype", `생성한 페이지가 안전 검사를 통과하지 못했습니다: ${out.problems.join(" / ")}`, false, "아이디어를 더 구체적으로 적어 다시 맡겨 주세요.");
  }
  const result = baseResult(job, out.proto.title);
  result.highlights = out.proto.highlights;
  result.nextAction = out.proto.nextAction;
  result.assumptions = [out.proto.interpretation];
  result.coverageNotes = [
    ...ing.notes,
    `핵심 행동: ${out.proto.coreAction}`,
    `눌러 볼 순서: ${out.proto.howToTry.join(" → ")}`,
    "코드 정적 검사 통과: 스크립트·입력 요소 있음, 외부 리소스·네트워크·저장소·상위 창 접근 없음.",
    "버튼 동작은 자동 클릭 검사를 하지 않았습니다. 열어서 직접 확인하세요.",
    "격리: sandbox iframe(allow-scripts만) + CSP default-src 'none'.",
  ];
  const { artifactId } = await step(job.id, "store_artifact", deps, async () => {
    const id = newId("a");
    saveArtifact(id, out.proto.html, "html");
    return { artifactId: id };
  });
  result.artifactId = artifactId;
  result.artifactUrl = `/p/${artifactId}`;
  result.downloadUrl = `/p/${artifactId}/raw?download=1`;
  await syncNotion(job, result, deps);
  return { status: "completed", result };
}

// ---- W5 요약 ----

async function runSummary(job: Job, deps: WorkerDeps): Promise<Outcome> {
  const url = job.input.url as string;
  const ytId = YT.parseYouTubeId(url);
  if (!ytId || job.sample) {
    const ing = await ingest(job, deps);
    if (!ing.fetched && !job.sample) {
      throw new StepError("ingest", "unreadable_url", ing.notes.join(" "), false, "로그인 없이 열리는 다른 링크를 담거나, 본문을 메모로 붙여 개념알기로 맡겨 주세요.");
    }
    const s = await step(job.id, "generate", deps, () =>
      sampleOr(job, F.SAMPLE_SUMMARY, () => askKiro(job, "generate", P.summaryPrompt(ctxOf(job, ing, deps), "web"), SummarySchema, [], deps)),
    );
    const result = baseResult(job, s.title);
    result.highlights = s.highlights;
    result.nextAction = s.nextAction;
    result.coverageNotes = [...ing.notes, "웹페이지 본문(텍스트)만 근거로 요약했습니다. 이미지·동영상·로그인 영역은 읽지 않았습니다."];
    result.sources = ing.fetched ? [{ id: "S1", title: ing.fetched.title ?? url, url: ing.fetched.url, accessedAt: deps.now().toISOString(), reachable: true, httpStatus: 200 }] : [];
    const { artifactId } = await step(job.id, "store_artifact", deps, async () => storeReport(job, result, "completed", summaryBody(s, [], null), deps));
    attachReport(result, artifactId);
    await syncNotion(job, result, deps);
    return { status: "completed", result };
  }

  // 유튜브: 메타데이터 → 자막 → 자막 기반 요약 → 실제 프레임 캡처
  const dir = sandboxFor(job.id);
  const ing = await step(job.id, "ingest", deps, async () => {
    let meta: YT.YouTubeMeta;
    try {
      meta = await deps.youtube.fetchMeta(ytId);
    } catch (e) {
      throw new StepError("ingest", "video_unavailable", e instanceof Error ? e.message : "영상 정보를 읽지 못했습니다.", false, "공개 영상 링크인지 확인해 주세요.");
    }
    if (meta.durationSeconds && meta.durationSeconds > YT.YT_LIMITS.maxSeconds) {
      throw new StepError("ingest", "too_long", `영상 길이 ${Math.round(meta.durationSeconds / 60)}분: 이번 버전은 20분 이하 영상만 요약합니다.`, false, "20분 이하 영상을 담거나 필요한 구간만 메모로 적어 주세요.");
    }
    const tr = await deps.youtube.fetchTranscript(ytId, dir);
    if (!tr) throw new StepError("ingest", "no_transcript", "자막을 찾지 못했습니다. 장면만으로 요약하지 않습니다.", false, "자막이 있는 영상이나 원문 텍스트를 담아 주세요.");
    const text = tr.lines.join("\n");
    return { meta, lang: tr.lang, fetched: { url: `https://www.youtube.com/watch?v=${ytId}`, title: meta.title, text: text.slice(0, 60_000), truncated: text.length > 60_000 }, notes: [`자막(${tr.lang}) ${tr.lines.length}줄을 읽었습니다.`] };
  });
  const s: Summary = await step(job.id, "generate", deps, () =>
    askKiro(job, "generate", P.summaryPrompt(ctxOf(job, { fetched: ing.fetched, notes: ing.notes }, deps), "youtube"), SummarySchema, [], deps),
  );
  const scenes = await step(job.id, "verify", deps, async () => {
    const secs = [...new Set(s.sceneSeconds)].filter((x) => !ing.meta.durationSeconds || x < ing.meta.durationSeconds).sort((a, b) => a - b);
    const frames = await deps.youtube.captureFrames(ytId, secs, dir);
    return frames.map((f) => ({ seconds: f.seconds, src: `data:image/jpeg;base64,${fs.readFileSync(f.file).toString("base64")}`, label: "실제 영상 프레임(자막 시각 기준)" }));
  });
  const result = baseResult(job, ing.meta.title);
  result.highlights = s.highlights;
  result.nextAction = s.nextAction;
  result.sources = [{ id: "S1", title: ing.meta.title, url: ing.fetched.url, publishedAt: ing.meta.uploadDate, accessedAt: deps.now().toISOString(), reachable: true, httpStatus: 200 }];
  result.status = "partial";
  result.coverageNotes = [
    ...ing.notes,
    "요약 근거: 자막 텍스트. AI가 영상 화면을 직접 보지 않았습니다.",
    scenes.length
      ? `실제 영상 스트림에서 ${scenes.length}개 시각의 프레임을 캡처했습니다. 화면 내용 확인(장면 이해)은 미완료입니다.`
      : "장면 캡처를 확보하지 못했습니다: 자막 기반 요약, 장면 확인 미완료.",
  ];
  const { artifactId } = await step(job.id, "store_artifact", deps, async () => storeReport(job, result, "partial", summaryBody(s, scenes, ing.fetched.url), deps));
  attachReport(result, artifactId);
  await syncNotion(job, result, deps);
  return { status: "partial", result };
}

// ---- W6 일정 ----

async function runSchedule(job: Job, deps: WorkerDeps): Promise<Outcome> {
  const ing = await ingest(job, deps);
  requireReadable(job, ing);
  const extraction: ScheduleExtraction = await step(job.id, "generate", deps, () =>
    sampleOr(job, F.SAMPLE_SCHEDULE, () => askKiro(job, "generate", P.schedulePrompt(ctxOf(job, ing, deps)), ScheduleExtractionSchema, [], deps)),
  );
  // 모델의 yearStated를 원문·답변으로 다시 확인한 뒤 판정한다(검증된 원문만 근거, 모델 excerpt는 쓰지 않음)
  const decision: ScheduleDecision = await step(job.id, "verify", deps, async () =>
    decideSchedule(verifyYearStated(extraction, [job.input.text, ing.fetched?.text, answersText(job)]), job.timeZone, deps.now()),
  );
  const result = baseResult(job, decision.event?.title ?? "일정 확인 필요");
  result.assumptions = decision.assumptions;
  result.coverageNotes = [...ing.notes, ...decision.notes];
  if (decision.status === "needs_input") {
    result.status = "needs_input";
    result.highlights = ["등록 전에 확인할 것이 있습니다."];
    return { status: "needs_input", result, question: decision.question };
  }
  const e = decision.event!;
  result.highlights = [`${e.date} ${e.startTime}–${e.endTime} ${e.title}`, `알림: ${decision.reminders.map((r) => r.label).join(", ")}`];
  const { artifactId } = await step(job.id, "store_artifact", deps, async () => storeReport(job, result, "awaiting_external_action", scheduleBody(decision), deps));
  attachReport(result, artifactId);
  await syncNotion(job, result, deps);
  await step(job.id, "external_action", deps, async () => ({ provider: "google_calendar", state: job.sample ? "sample_no_write" : "not_configured" }));
  result.status = "partial";
  result.coverageNotes.push(
    job.sample ? "샘플 모드: Calendar에 쓰지 않습니다." : "Google Calendar가 연결되지 않아 일정을 만들지 않았습니다. 일정 URL이 없습니다.",
    "알림 등록과 기기에 알림이 실제로 도착하는지는 별개입니다.",
  );
  result.nextAction = "Google Calendar를 연결하면 이 내용(전날 같은 시각·당일 시작 시각 알림)으로 등록합니다.";
  result.errors.push({ stage: "external_action", code: "calendar_not_connected", message: "Calendar 연결 없음", retryable: false });
  return { status: "awaiting_external_action", result };
}

const RUNNERS: Record<Job["workflow"], (job: Job, deps: WorkerDeps) => Promise<Outcome>> = {
  concept_report: runConcept,
  concept_video: runConcept,
  idea_report: runIdeas,
  idea_prototype: runPrototype,
  url_summary: runSummary,
  calendar_event: runSchedule,
};

/** 점유한 작업 하나를 끝까지(또는 다음 대기 상태까지) 실행한다 */
export async function processJob(id: string, deps: WorkerDeps): Promise<JobStatus | null> {
  const job = getJob(id);
  if (!job) return null;
  try {
    const out = await RUNNERS[job.workflow](job, deps);
    const final = updateJob(id, (j) => {
      if (j.status === "cancelled") return false;
      j.status = out.status;
      j.stage = null;
      j.result = out.result;
      j.leaseUntil = null;
      j.question = out.question ? { text: out.question, answer: null } : null;
      j.completedAt = deps.now().toISOString();
      pushHistory(j, `${out.status} (${out.result.status})`, deps.now());
    });
    return final?.status ?? null;
  } catch (error) {
    if (error instanceof Cancelled) return "cancelled";
    const se =
      error instanceof StepError
        ? error
        : new StepError(getJob(id)?.stage ?? "ingest", "internal", "워커 내부 오류가 발생했습니다.", true);
    if (!(error instanceof StepError)) console.error(`[worker] ${id} internal error: ${(error as Error)?.name ?? "unknown"}`);
    const final = updateJob(id, (j) => {
      if (j.status === "cancelled") return false;
      j.leaseUntil = null;
      j.stage = null;
      if (j.steps[se.stage]) j.steps[se.stage] = { status: "failed", at: deps.now().toISOString(), note: se.code };
      if (se.retryable && j.attempts < MAX_ATTEMPTS) {
        const delay = 30_000 * 2 ** (j.attempts - 1);
        j.status = "scheduled";
        j.runAt = new Date(deps.now().getTime() + delay).toISOString();
        pushHistory(j, `재시도 예약(${se.code}${se.code === "invalid_output" ? ` · ${se.message}` : ""}, ${Math.round(delay / 1000)}초 뒤)`, deps.now());
        return;
      }
      const result = baseResult(j, "처리하지 못했습니다");
      // 입력 수집 단계에서 멈췄으면 생성 엔진을 부르지 않았다. 화면에 "kiro-cli 실제 생성"으로 보이지 않게 코드 판정으로 표시한다
      if (se.stage === "ingest" && !j.sample) result.engine = "code";
      result.status = "failed" as ResultStatus;
      result.highlights = [se.message];
      result.nextAction = se.nextAction ?? "입력을 확인하고 다시 맡겨 주세요.";
      result.errors.push({ stage: se.stage, code: se.code, message: se.message, retryable: se.retryable });
      result.notionSyncStatus = "not_configured";
      j.status = "failed";
      j.result = result;
      j.completedAt = deps.now().toISOString();
      pushHistory(j, `실패(${se.code})`, deps.now());
    });
    return final?.status ?? null;
  }
}
