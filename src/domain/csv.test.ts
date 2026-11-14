import { describe, expect, it } from "vitest";
import { parseCsv, parseNonNegativeInt } from "./csv";

describe("parseCsv", () => {
  it("따옴표 안 쉼표와 실제 행 번호(빈 줄·여러 줄 필드 포함)를 처리한다", () => {
    // 1: 헤더, 2: 쉼표 포함 필드, 3: 빈 줄, 4~5: 줄바꿈 포함 필드, 6: 일반 행
    const csv = '﻿a,b\r\n1,"x,y"\r\n\r\n2,"multi\nline"\n3,z\n';
    const { rows, issues } = parseCsv(csv, ["a", "b"]);
    expect(issues).toEqual([]);
    expect(rows.map((r) => [r.line, r.cells.a, r.cells.b])).toEqual([
      [2, "1", "x,y"],
      [4, "2", "multi\nline"],
      [6, "3", "z"],
    ]);
  });

  it("필수 열 누락을 1행 오류로 보고한다", () => {
    const { issues } = parseCsv("a,c\n1,2\n", ["a", "b"]);
    expect(issues).toContainEqual(expect.objectContaining({ severity: "error", line: 1 }));
  });

  it("닫히지 않은 따옴표는 해당 행의 형식 오류다", () => {
    const { issues } = parseCsv('a,b\n1,ok\n2,"broken\n', ["a", "b"]);
    expect(issues.some((i) => i.severity === "error" && i.line === 3)).toBe(true);
  });

  it("빈 입력과 헤더만 있는 입력을 오류로 본다", () => {
    expect(parseCsv("", ["a"]).issues[0].severity).toBe("error");
    expect(parseCsv("a\n", ["a"]).issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("열 개수가 헤더와 다른 행은 값을 버리거나 밀지 않고 해당 행 오류로 본다", () => {
    const { rows, issues } = parseCsv("a,b\n1,2,3\n4\n5,6\n", ["a", "b"]);
    expect(issues.filter((i) => i.severity === "error").map((i) => i.line)).toEqual([2, 3]);
    expect(rows.map((r) => [r.line, r.cells.a, r.cells.b])).toEqual([[4, "5", "6"]]);
  });

  it("중복 열 이름은 헤더 오류다(뒤 값으로 덮어쓰지 않음)", () => {
    const { issues } = parseCsv("a,b,b\n1,2,3\n", ["a", "b"]);
    expect(issues).toContainEqual(expect.objectContaining({ severity: "error", line: 1 }));
  });

  it("이름 없는 열에 값이 있으면 오류, 비어 있으면 허용한다", () => {
    expect(parseCsv("a,b,\n1,2,3\n", ["a", "b"]).issues).toContainEqual(
      expect.objectContaining({ severity: "error", line: 2 }),
    );
    expect(parseCsv("a,b,\n1,2,\n", ["a", "b"]).issues).toEqual([]);
  });

  it("행 번호 계산이 줄 수에 비례한다(빈 줄 4만 개)", () => {
    const started = performance.now();
    const { rows } = parseCsv("a\n" + "\n".repeat(40_000) + "1", ["a"]);
    expect(rows.map((r) => r.line)).toEqual([40_002]);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("parseNonNegativeInt", () => {
  it.each([
    ["0", 0],
    ["450000", 450000],
    ["900,000", 900000],
    [" 12 ", 12],
  ])("%s → %d", (input, expected) => {
    expect(parseNonNegativeInt(input)).toBe(expected);
  });

  it.each(["", "-1", "1.5", "오십만원", "50만", "1,20,000", "12a"])("%s → null", (input) => {
    expect(parseNonNegativeInt(input)).toBeNull();
  });
});
