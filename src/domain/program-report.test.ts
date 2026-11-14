import { describe, expect, it } from "vitest";
import { programBoundaryCsv, programErrorCsv, programNormalCsv } from "./fixtures/program-report";
import { analyzeProgramCsv } from "./program-report";

const metric = (a: ReturnType<typeof analyzeProgramCsv>, id: string) => a.metrics.find((m) => m.id === id)?.value;

describe("정상 데이터 집계 — 손 검산 값과 비교", () => {
  const a = analyzeProgramCsv(programNormalCsv);

  it("오류 없이 6개 프로그램을 집계한다", () => {
    expect(a.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(a.canDraft).toBe(true);
    expect(metric(a, "SUM-PROGRAMS")).toBe("6개");
  });

  it("신청자 140명, 수료자 115명, 집행액 2,800,000원", () => {
    expect(metric(a, "SUM-APPLICANTS")).toBe("140명");
    expect(metric(a, "SUM-COMPLETERS")).toBe("115명");
    expect(metric(a, "SUM-SPENT")).toBe("2,800,000원");
  });

  it("전체 수료율은 115/140 = 82.14%이고 프로그램별 단순 평균(83.21%)이 아니다", () => {
    expect(metric(a, "SUM-RATE")).toBe("82.14%");
    expect(metric(a, "SUM-RATE")).not.toBe("83.21%");
  });

  it("따옴표 안 쉼표가 있는 프로그램명과 천 단위 쉼표 집행액을 읽는다", () => {
    const row4 = a.table?.rows.find((r) => r.id === "ROW-4");
    expect(row4?.cells.name).toBe("글쓰기 클리닉, 심화");
    const row5 = a.table?.rows.find((r) => r.id === "ROW-5");
    expect(row5?.cells.spent).toBe("900,000원");
    expect(row5?.cells.rate).toBe("74.29%"); // 26/35
  });

  it("근거 ID는 집계 5개 + 행 6개이고 행 번호를 담는다", () => {
    expect(a.evidence.map((e) => e.id)).toEqual([
      "SUM-PROGRAMS",
      "SUM-APPLICANTS",
      "SUM-COMPLETERS",
      "SUM-RATE",
      "SUM-SPENT",
      "ROW-2",
      "ROW-3",
      "ROW-4",
      "ROW-5",
      "ROW-6",
      "ROW-7",
    ]);
  });
});

describe("오류 데이터", () => {
  const a = analyzeProgramCsv(programErrorCsv);
  const errors = a.issues.filter((i) => i.severity === "error");

  it("중복·초과 수료·부서 누락·숫자 아닌 집행액을 실제 행 번호로 보고한다", () => {
    expect(errors.map((e) => [e.line, e.field])).toEqual([
      [3, "수료자수"],
      [4, "부서"],
      [5, "집행액"],
      [6, "프로그램명"],
    ]);
    expect(errors[3].message).toContain("2행");
  });

  it("오류가 있으면 AI 초안을 막고 참고값임을 알린다", () => {
    expect(a.canDraft).toBe(false);
    expect(a.metricsNote).toContain("오류 4건");
    // 오류 없는 2행만 반영: 신청 30, 수료 27
    expect(metric(a, "SUM-APPLICANTS")).toBe("30명");
  });
});

describe("경계값", () => {
  it("신청자 0명 행의 수료율은 계산 불가이고 경고로 남는다", () => {
    const a = analyzeProgramCsv(programBoundaryCsv);
    expect(a.table?.rows.find((r) => r.id === "ROW-3")?.cells.rate).toBe("계산 불가");
    expect(a.issues).toContainEqual(expect.objectContaining({ severity: "warning", line: 3 }));
    expect(metric(a, "SUM-RATE")).toBe("90.00%"); // 27/30
    expect(a.canDraft).toBe(true);
  });

  it("전체 신청자가 0이면 전체 수료율도 계산 불가(Infinity·NaN·0% 아님)", () => {
    const a = analyzeProgramCsv("프로그램명,부서,신청자수,수료자수,집행액\n취소 행사,학생지원팀,0,0,0\n");
    const rate = metric(a, "SUM-RATE");
    expect(rate).toBe("계산 불가");
    expect(rate).not.toMatch(/Infinity|NaN|^0/);
  });

  it("신청자 0명인데 수료자가 있으면 오류다", () => {
    const a = analyzeProgramCsv("프로그램명,부서,신청자수,수료자수,집행액\n이상 행사,학생지원팀,0,3,0\n");
    expect(a.canDraft).toBe(false);
  });
});
