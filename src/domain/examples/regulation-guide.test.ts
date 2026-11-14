import { describe, expect, it } from "vitest";
import { regulationBoundaryCsv, regulationErrorCsv, regulationNormalCsv } from "../fixtures/regulation-guide";
import { analyzeRegulationCsv, parseDate } from "./regulation-guide";

const cells = (a: ReturnType<typeof analyzeRegulationCsv>, id: string) => a.table?.rows.find((r) => r.id === id)?.cells;

describe("연습용 가상 규정 어댑터", () => {
  it("정상: 신청 마감·검토자·결과보고 마감을 계산한다", () => {
    const a = analyzeRegulationCsv(regulationNormalCsv);
    expect(a.canDraft).toBe(true);
    expect(cells(a, "EVT-2")).toMatchObject({ deadline: "2026-12-03", onTime: "충족", reviewer: "부서장", reportDue: "2026-12-24" });
    expect(cells(a, "EVT-3")).toMatchObject({ deadline: "2026-12-08", reviewer: "센터장", reportDue: "2026-12-30" });
    expect(cells(a, "EVT-4")).toMatchObject({ deadline: "2027-01-01", reportDue: "2027-01-22" });
    expect(a.evidence.some((e) => e.id === "RULE-APPLY-7D" && e.value === "연습용 가상 규정")).toBe(true);
  });

  it("경계값: 정확히 7일 전은 충족, 6일 전은 미충족 / 50만원은 부서장, 500,001원은 센터장", () => {
    const a = analyzeRegulationCsv(regulationBoundaryCsv);
    expect(cells(a, "EVT-2")).toMatchObject({ onTime: "충족", reviewer: "부서장" });
    expect(cells(a, "EVT-3")).toMatchObject({ onTime: "미충족", reviewer: "센터장" });
    expect(a.issues).toContainEqual(expect.objectContaining({ severity: "warning", line: 3 }));
  });

  it("오류: 없는 날짜, 역전된 기간, 숫자 아닌 예산", () => {
    const a = analyzeRegulationCsv(regulationErrorCsv);
    const errors = a.issues.filter((i) => i.severity === "error");
    expect(errors.map((e) => [e.line, e.field])).toEqual([
      [2, "신청일"],
      [3, "종료일"],
      [4, "예산"],
    ]);
    expect(a.canDraft).toBe(false);
  });

  it("필수 열이 없으면 예외 없이 오류를 반환한다", () => {
    const a = analyzeRegulationCsv("행사명,예산\nA,1000\n");
    expect(a.canDraft).toBe(false);
    expect(a.issues[0].severity).toBe("error");
  });

  it("parseDate는 달력에 없는 날짜를 거부한다", () => {
    expect(parseDate("2026-02-30")).toBeNull();
    expect(parseDate("2026-2-3")).toBeNull();
    expect(parseDate("2028-02-29")).not.toBeNull();
  });
});
