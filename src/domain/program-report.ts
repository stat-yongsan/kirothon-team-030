// 주제 1: 비교과 프로그램 결과보고서 검증 도우미 (기본 작동 예제)
import { parseCsv, parseNonNegativeInt } from "./csv";
import { formatInt, formatPercent, formatWon, percent } from "./format";
import {
  programBoundaryCsv,
  programErrorCsv,
  programNormalCsv,
} from "./fixtures/program-report";
import type { Analysis, DomainAdapter, Evidence, Issue } from "./types";
import { hasErrors } from "./types";

const COLS = {
  name: "프로그램명",
  dept: "부서",
  applicants: "신청자수",
  completers: "수료자수",
  spent: "집행액",
} as const;
const REQUIRED = Object.values(COLS);

interface ProgramRow {
  line: number;
  name: string;
  dept: string;
  applicants: number;
  completers: number;
  spent: number;
  rate: number | null;
}

export function analyzeProgramCsv(raw: string): Analysis {
  const parsed = parseCsv(raw, REQUIRED);
  const issues: Issue[] = [...parsed.issues];
  if (parsed.headers.length === 0 || REQUIRED.some((h) => !parsed.headers.includes(h))) {
    return { issues, metrics: [], table: null, evidence: [], canDraft: false };
  }

  const valid: ProgramRow[] = [];
  const firstLineByKey = new Map<string, number>();

  for (const { line, cells } of parsed.rows) {
    const rowIssues: Issue[] = [];
    const err = (field: string, message: string) =>
      rowIssues.push({ severity: "error", line, field, message });

    const name = cells[COLS.name];
    const dept = cells[COLS.dept];
    if (!name) err(COLS.name, "프로그램명이 비어 있습니다");
    if (!dept) err(COLS.dept, "부서가 비어 있습니다");

    const applicants = parseNonNegativeInt(cells[COLS.applicants]);
    const completers = parseNonNegativeInt(cells[COLS.completers]);
    const spent = parseNonNegativeInt(cells[COLS.spent]);
    if (applicants === null)
      err(COLS.applicants, `신청자수가 0 이상의 정수가 아닙니다: "${cells[COLS.applicants]}"`);
    if (completers === null)
      err(COLS.completers, `수료자수가 0 이상의 정수가 아닙니다: "${cells[COLS.completers]}"`);
    if (spent === null)
      err(COLS.spent, `집행액이 숫자가 아닙니다: "${cells[COLS.spent]}" (예: 450000 또는 "450,000")`);
    if (applicants !== null && completers !== null && completers > applicants)
      err(COLS.completers, `수료자수(${completers})가 신청자수(${applicants})보다 많습니다`);

    if (name && dept) {
      const key = `${name}\u0000${dept}`;
      const first = firstLineByKey.get(key);
      if (first !== undefined) {
        err(COLS.name, `중복 행: ${first}행과 프로그램명·부서가 같습니다`);
      } else {
        firstLineByKey.set(key, line);
      }
    }

    issues.push(...rowIssues);
    if (rowIssues.length === 0 && applicants !== null && completers !== null && spent !== null) {
      const rate = percent(completers, applicants);
      if (rate === null) {
        issues.push({
          severity: "warning",
          line,
          field: COLS.applicants,
          message: "신청자 0명 — 이 프로그램의 수료율은 계산 불가로 표시합니다",
        });
      }
      valid.push({ line, name, dept, applicants, completers, spent, rate });
    }
  }

  const totalApplicants = sum(valid.map((r) => r.applicants));
  const totalCompleters = sum(valid.map((r) => r.completers));
  const totalSpent = sum(valid.map((r) => r.spent));
  // 전체 수료율은 합계로 계산한다. 프로그램별 수료율의 단순 평균으로 대체하지 않는다.
  const overallRate = percent(totalCompleters, totalApplicants);
  const errorCount = issues.filter((i) => i.severity === "error").length;

  const evidence: Evidence[] = [
    { id: "SUM-PROGRAMS", label: "집계 프로그램 수", value: `${valid.length}개`, source: "코드 집계" },
    { id: "SUM-APPLICANTS", label: "전체 신청자", value: `${formatInt(totalApplicants)}명`, source: "코드 집계" },
    { id: "SUM-COMPLETERS", label: "전체 수료자", value: `${formatInt(totalCompleters)}명`, source: "코드 집계" },
    {
      id: "SUM-RATE",
      label: "전체 수료율(수료자 합계 ÷ 신청자 합계)",
      value: formatPercent(overallRate),
      source: "코드 집계",
    },
    { id: "SUM-SPENT", label: "전체 집행액", value: formatWon(totalSpent), source: "코드 집계" },
    ...valid.map((r) => ({
      id: `ROW-${r.line}`,
      label: `${r.name} (${r.dept})`,
      value: `신청 ${formatInt(r.applicants)}명, 수료 ${formatInt(r.completers)}명, 수료율 ${formatPercent(r.rate)}, 집행 ${formatWon(r.spent)}`,
      source: `입력 CSV ${r.line}행`,
    })),
  ];

  return {
    issues,
    metrics: [
      { id: "SUM-PROGRAMS", label: "프로그램", value: `${valid.length}개` },
      { id: "SUM-APPLICANTS", label: "신청자 합계", value: `${formatInt(totalApplicants)}명` },
      { id: "SUM-COMPLETERS", label: "수료자 합계", value: `${formatInt(totalCompleters)}명` },
      {
        id: "SUM-RATE",
        label: "전체 수료율",
        value: formatPercent(overallRate),
        note: "수료자 합계 ÷ 신청자 합계 × 100",
      },
      { id: "SUM-SPENT", label: "집행액 합계", value: formatWon(totalSpent) },
    ],
    metricsNote:
      errorCount > 0 ? `오류 ${errorCount}건이 있는 행을 제외한 참고값입니다. 오류를 고치면 다시 계산합니다.` : undefined,
    table: {
      caption: "프로그램별 결과",
      columns: [
        { key: "line", label: "행", align: "right" },
        { key: "name", label: "프로그램명" },
        { key: "dept", label: "부서" },
        { key: "applicants", label: "신청", align: "right" },
        { key: "completers", label: "수료", align: "right" },
        { key: "rate", label: "수료율", align: "right" },
        { key: "spent", label: "집행액", align: "right" },
      ],
      rows: valid.map((r) => ({
        id: `ROW-${r.line}`,
        cells: {
          line: String(r.line),
          name: r.name,
          dept: r.dept,
          applicants: formatInt(r.applicants),
          completers: formatInt(r.completers),
          rate: formatPercent(r.rate),
          spent: formatWon(r.spent),
        },
      })),
    },
    evidence,
    canDraft: !hasErrors(issues) && valid.length > 0,
  };
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export const programReport: DomainAdapter = {
  id: "program-report",
  title: "비교과 프로그램 결과보고서 검증 도우미",
  tagline: "CSV 수치를 검증·집계하고, 근거가 연결된 결과보고서 초안을 만듭니다",
  user: "대학 비교과 프로그램 운영 담당자",
  input: {
    label: "프로그램 실적 CSV",
    help: "열: 프로그램명, 부서, 신청자수, 수료자수, 집행액. 첫 줄은 헤더입니다.",
    placeholder: "프로그램명,부서,신청자수,수료자수,집행액\nAI 리터러시 특강,교수학습지원센터,30,27,450000",
    accept: ".csv,text/csv",
  },
  samples: [
    { id: "normal", label: "정상 샘플", description: "6개 프로그램, 오류 없음", content: programNormalCsv },
    { id: "errors", label: "오류 샘플", description: "중복·초과 수료·부서 누락·숫자 오류", content: programErrorCsv },
    { id: "boundary", label: "경계값 샘플", description: "신청자 0명 프로그램 포함", content: programBoundaryCsv },
  ],
  analyze: analyzeProgramCsv,
  ai: {
    system:
      "당신은 대학 비교과 프로그램 결과보고서를 작성하는 행정 문서 보조자입니다. 공문서체(~함, ~임)로 간결하게 씁니다.",
    instruction:
      "검증된 집계 결과로 비교과 프로그램 결과보고서 초안을 작성하세요. 운영 개요, 성과(수료율 중심), 예산 집행, 개선 제안 순서로 3~4개 섹션을 만들고, 각 섹션에 사용한 근거 ID를 연결하세요. 수료율이 계산 불가인 프로그램은 그 사실을 그대로 적으세요.",
  },
  report: {
    title: "비교과 프로그램 결과보고서(초안)",
    filename: "program-report.md",
  },
};
