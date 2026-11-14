import { describe, expect, it } from "vitest";
import { programNormalCsv } from "@/domain/fixtures/program-report";
import { analyzeProgramCsv, programReport } from "@/domain/program-report";
import { buildMarkdown } from "./markdown";

const analysis = analyzeProgramCsv(programNormalCsv);
const draft = {
  summary: "요약 | 파이프 포함",
  sections: [{ heading: "성과", body: "전체 수료율 82.14%.", evidenceIds: ["SUM-RATE"] }],
  cautions: ["만족도 자료는 확인 필요"],
};

describe("buildMarkdown", () => {
  it("모드·검토 상태·근거 연결·집계·근거 목록을 담는다", () => {
    const md = buildMarkdown(programReport, analysis, draft, {
      mode: "live",
      model: "claude-opus-5-5",
      reviewed: true,
      generatedAt: "2026-11-13 10:00",
    });
    expect(md).toContain("실제 AI 응답 (live, claude-opus-5-5)");
    expect(md).toContain("검토 완료");
    expect(md).toContain("> 근거: [SUM-RATE] 전체 수료율(수료자 합계 ÷ 신청자 합계): 82.14%");
    expect(md).toContain("| 신청자 합계 | 140명 |");
    expect(md).toContain("| 집행액 합계 | 2,800,000원 |");
    expect(md).toContain("| 4 | 글쓰기 클리닉, 심화 |");
    expect(md).toContain("## 근거 목록");
    expect(md).toContain("- 만족도 자료는 확인 필요");
  });

  it("mock·미검토를 숨기지 않고 표 셀의 파이프를 이스케이프한다", () => {
    const md = buildMarkdown(
      programReport,
      { ...analysis, metrics: [{ id: "X", label: "a|b", value: "1" }] },
      draft,
      { mode: "mock", model: null, reviewed: false, generatedAt: "t" },
    );
    expect(md).toContain("샘플 응답 (mock, 실제 AI 아님)");
    expect(md).toContain("검토 상태: 미검토");
    expect(md).toContain("| a\\|b | 1 |");
  });
});
