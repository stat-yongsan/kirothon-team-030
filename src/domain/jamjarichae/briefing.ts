// 아침 브리핑 집계. 숫자는 저장된 작업 상태만 센다(근거 없는 진행률을 만들지 않는다).
import type { JobStatus } from "./contracts.ts";
import type { JobView } from "./job.ts";

export interface Briefing {
  total: number;
  counts: Record<"completed" | "partial" | "needs_input" | "external" | "failed" | "in_progress" | "saved", number>;
  /** "맡긴 5개 중 완료 3, 확인 필요 1, 부분 완료 1" */
  sentence: string;
  /** 먼저 볼 결과 최대 3개(완료 → 부분 완료 순, 최근 완료 우선) */
  top: JobView[];
  /** 내 답변이 필요한 작업 */
  questions: JobView[];
}

const BUCKET: Record<JobStatus, keyof Briefing["counts"] | null> = {
  draft: "saved",
  scheduled: "in_progress",
  queued: "in_progress",
  running: "in_progress",
  needs_input: "needs_input",
  awaiting_external_action: "external",
  awaiting_external_confirmation: "external",
  completed: "completed",
  partial: "partial",
  failed: "failed",
  cancelled: null,
};

export function buildBriefing(jobs: JobView[]): Briefing {
  const counts: Briefing["counts"] = {
    completed: 0,
    partial: 0,
    needs_input: 0,
    external: 0,
    failed: 0,
    in_progress: 0,
    saved: 0,
  };
  const entrusted = jobs.filter((j) => j.status !== "draft" && j.status !== "cancelled");
  for (const j of jobs) {
    const b = BUCKET[j.status];
    if (b) counts[b] += 1;
  }

  const parts: string[] = [];
  if (counts.completed) parts.push(`완료 ${counts.completed}`);
  if (counts.partial) parts.push(`부분 완료 ${counts.partial}`);
  if (counts.needs_input) parts.push(`확인 필요 ${counts.needs_input}`);
  if (counts.external) parts.push(`외부 조치 필요 ${counts.external}`);
  if (counts.failed) parts.push(`실패 ${counts.failed}`);
  if (counts.in_progress) parts.push(`진행 중 ${counts.in_progress}`);
  const sentence =
    entrusted.length === 0
      ? "아직 맡긴 생각이 없습니다."
      : `맡긴 ${entrusted.length}개 중 ${parts.join(", ")}`;

  const rank = (j: JobView) => (j.status === "completed" ? 0 : j.status === "partial" ? 1 : 2);
  const top = jobs
    .filter((j) => (j.status === "completed" || j.status === "partial") && j.result)
    .sort((a, b) => rank(a) - rank(b) || (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
    .slice(0, 3);

  const questions = jobs.filter((j) => j.status === "needs_input" && j.question && !j.question.answer);
  return { total: entrusted.length, counts, sentence, top, questions };
}
