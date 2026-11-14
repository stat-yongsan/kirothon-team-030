import type { Analysis, DomainAdapter } from "@/domain/types";
import type { Draft } from "@/lib/ai/schema";

export interface ReportMeta {
  mode: "mock" | "live";
  model: string | null;
  reviewed: boolean;
  generatedAt: string;
}

function cell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function table(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.map(cell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`),
  ].join("\n");
}

/** 검토된 초안 + 코드 집계 + 근거 목록을 하나의 Markdown 문서로 만든다 */
export function buildMarkdown(
  adapter: DomainAdapter,
  analysis: Analysis,
  draft: Draft,
  meta: ReportMeta,
): string {
  const byId = new Map(analysis.evidence.map((e) => [e.id, e]));
  const out: string[] = [];

  out.push(`# ${adapter.report.title}`, "");
  out.push(`- 작성 시각: ${meta.generatedAt}`);
  out.push(
    `- AI 모드: ${meta.mode === "live" ? `실제 AI 응답 (live${meta.model ? `, ${meta.model}` : ""})` : "샘플 응답 (mock, 실제 AI 아님)"}`,
  );
  out.push(`- 검토 상태: ${meta.reviewed ? "검토 완료 (담당자 확인)" : "미검토"}`, "");

  out.push("## 요약", "", draft.summary, "");

  for (const s of draft.sections) {
    out.push(`## ${s.heading}`, "", s.body, "");
    const refs = s.evidenceIds.map((id) => {
      const e = byId.get(id);
      return e ? `[${id}] ${e.label}: ${e.value}` : `[${id}]`;
    });
    out.push(`> 근거: ${refs.join(" / ")}`, "");
  }

  if (analysis.metrics.length > 0) {
    out.push("## 코드 집계 결과", "");
    out.push(table(["지표", "값", "비고"], analysis.metrics.map((m) => [m.label, m.value, m.note ?? ""])), "");
  }

  if (analysis.table && analysis.table.rows.length > 0) {
    const t = analysis.table;
    out.push(`## ${t.caption}`, "");
    out.push(
      table(
        t.columns.map((c) => c.label),
        t.rows.map((r) => t.columns.map((c) => r.cells[c.key] ?? "")),
      ),
      "",
    );
  }

  const warnings = analysis.issues.filter((i) => i.severity === "warning");
  if (warnings.length > 0) {
    out.push("## 검증 메모", "");
    for (const w of warnings) out.push(`- ${w.line ? `${w.line}행: ` : ""}${w.message}`);
    out.push("");
  }

  if (draft.cautions.length > 0) {
    out.push("## 확인 필요 사항", "");
    for (const c of draft.cautions) out.push(`- ${c}`);
    out.push("");
  }

  out.push("## 근거 목록", "");
  out.push(table(["ID", "항목", "값", "출처"], analysis.evidence.map((e) => [e.id, e.label, e.value, e.source])), "");

  return out.join("\n");
}
