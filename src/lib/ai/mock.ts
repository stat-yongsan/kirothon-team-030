import type { Analysis, DomainAdapter } from "@/domain/types";
import { validateDraft, type Draft } from "./schema";

/**
 * 샘플 응답(mock). 실제 AI가 작성하지 않았음을 문구에 드러낸다.
 * 실제 API 실패를 숨기는 대체값으로 사용하지 않는다(AI_MODE=mock일 때만 호출).
 */
export function generateMockDraft(adapter: DomainAdapter, analysis: Analysis): Draft {
  const head = analysis.evidence.slice(0, 5);
  const rest = analysis.evidence.slice(5, 13);
  const lines = (items: typeof head) => items.map((e) => `- ${e.label}: ${e.value}`).join("\n");

  const sections: Draft["sections"] = [
    { heading: "주요 수치", body: lines(head), evidenceIds: head.map((e) => e.id) },
  ];
  if (rest.length > 0) {
    sections.push({ heading: "세부 항목", body: lines(rest), evidenceIds: rest.map((e) => e.id) });
  }

  return validateDraft(
    {
      summary: `[샘플 응답] ${adapter.report.title}의 고정 형식 예시입니다. 실제 AI가 작성한 문장이 아니며, 수치는 코드 집계 결과를 그대로 옮겼습니다.`,
      sections,
      cautions: ["샘플 응답(mock)입니다. 실제 시연 전 AI_MODE=live로 최소 1회 검증하세요."],
    },
    analysis.evidence,
  );
}
