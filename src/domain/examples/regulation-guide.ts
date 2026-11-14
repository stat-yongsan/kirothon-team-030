// 주제 2(연습): 규정 기반 절차 안내. 공통 엔진 재사용을 확인하기 위한 작은 어댑터.
// 아래 규정은 모두 "연습용 가상 규정"이며 실제 대학 규정이 아니다.
import { parseCsv, parseNonNegativeInt } from "../csv";
import { formatInt, formatWon } from "../format";
import {
  regulationBoundaryCsv,
  regulationErrorCsv,
  regulationNormalCsv,
} from "../fixtures/regulation-guide";
import type { Analysis, DomainAdapter, Evidence, Issue } from "../types";
import { hasErrors } from "../types";

export const RULES = [
  { id: "RULE-APPLY-7D", text: "행사 시작 7일 전까지 신청", source: "연습용 가상 규정 제3조" },
  { id: "RULE-REVIEW-DEPT", text: "예산 50만원 이하: 부서장 검토", source: "연습용 가상 규정 제4조 제1항" },
  { id: "RULE-REVIEW-CENTER", text: "예산 50만원 초과: 센터장 검토", source: "연습용 가상 규정 제4조 제2항" },
  { id: "RULE-REPORT-14D", text: "행사 종료 후 14일 이내 결과보고", source: "연습용 가상 규정 제5조" },
] as const;

const COLS = { name: "행사명", applied: "신청일", start: "시작일", end: "종료일", budget: "예산" } as const;
const REVIEW_LIMIT = 500_000;
const DAY = 86_400_000;

/** YYYY-MM-DD, 실제 달력에 있는 날짜만 허용. UTC 자정 기준 epoch ms */
export function parseDate(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return t;
}

function fmtDate(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

export function analyzeRegulationCsv(raw: string): Analysis {
  const parsed = parseCsv(raw, Object.values(COLS));
  const issues: Issue[] = [...parsed.issues];
  if (Object.values(COLS).some((h) => !parsed.headers.includes(h))) {
    return { issues, metrics: [], table: null, evidence: [], canDraft: false };
  }

  const events: {
    line: number;
    name: string;
    applied: number;
    deadline: number;
    onTime: boolean;
    reviewer: "부서장" | "센터장";
    reportDue: number;
    budget: number;
  }[] = [];

  for (const { line, cells } of parsed.rows) {
    const before = issues.length;
    const err = (field: string, message: string) => issues.push({ severity: "error", line, field, message });
    const name = cells[COLS.name];
    const applied = parseDate(cells[COLS.applied]);
    const start = parseDate(cells[COLS.start]);
    const end = parseDate(cells[COLS.end]);
    const budget = parseNonNegativeInt(cells[COLS.budget]);
    if (!name) err(COLS.name, "행사명이 비어 있습니다");
    if (applied === null) err(COLS.applied, `날짜 형식 오류: "${cells[COLS.applied]}" (YYYY-MM-DD)`);
    if (start === null) err(COLS.start, `날짜 형식 오류: "${cells[COLS.start]}" (YYYY-MM-DD)`);
    if (end === null) err(COLS.end, `날짜 형식 오류: "${cells[COLS.end]}" (YYYY-MM-DD)`);
    if (start !== null && end !== null && end < start) err(COLS.end, "종료일이 시작일보다 빠릅니다");
    if (budget === null) err(COLS.budget, `예산이 숫자가 아닙니다: "${cells[COLS.budget]}"`);
    if (issues.length > before || applied === null || start === null || end === null || budget === null) continue;

    const deadline = start - 7 * DAY;
    const onTime = applied <= deadline;
    if (!onTime) {
      issues.push({
        severity: "warning",
        line,
        field: COLS.applied,
        message: `신청 기한 미충족: 마감 ${fmtDate(deadline)}, 신청 ${fmtDate(applied)} (RULE-APPLY-7D)`,
      });
    }
    events.push({
      line,
      name,
      applied,
      deadline,
      onTime,
      reviewer: budget <= REVIEW_LIMIT ? "부서장" : "센터장",
      reportDue: end + 14 * DAY,
      budget,
    });
  }

  const evidence: Evidence[] = [
    ...RULES.map((r) => ({ id: r.id, label: r.text, value: "연습용 가상 규정", source: r.source })),
    ...events.map((e) => ({
      id: `EVT-${e.line}`,
      label: e.name,
      value: `신청 마감 ${fmtDate(e.deadline)}(신청 ${fmtDate(e.applied)}, ${e.onTime ? "충족" : "미충족"}), 검토 ${e.reviewer}(예산 ${formatWon(e.budget)}), 결과보고 마감 ${fmtDate(e.reportDue)}`,
      source: `입력 CSV ${e.line}행`,
    })),
  ];

  return {
    issues,
    metrics: [
      { id: "EVT-COUNT", label: "행사", value: `${formatInt(events.length)}건` },
      { id: "EVT-ONTIME", label: "신청 기한 충족", value: `${events.filter((e) => e.onTime).length}건` },
      { id: "EVT-LATE", label: "신청 기한 미충족", value: `${events.filter((e) => !e.onTime).length}건` },
      { id: "EVT-CENTER", label: "센터장 검토", value: `${events.filter((e) => e.reviewer === "센터장").length}건` },
    ],
    table: {
      caption: "행사별 절차 (연습용 가상 규정 적용)",
      columns: [
        { key: "line", label: "행", align: "right" },
        { key: "name", label: "행사명" },
        { key: "deadline", label: "신청 마감" },
        { key: "onTime", label: "기한" },
        { key: "reviewer", label: "검토" },
        { key: "reportDue", label: "결과보고 마감" },
      ],
      rows: events.map((e) => ({
        id: `EVT-${e.line}`,
        cells: {
          line: String(e.line),
          name: e.name,
          deadline: fmtDate(e.deadline),
          onTime: e.onTime ? "충족" : "미충족",
          reviewer: e.reviewer,
          reportDue: fmtDate(e.reportDue),
        },
      })),
    },
    evidence,
    canDraft: !hasErrors(issues) && events.length > 0,
  };
}

export const regulationGuide: DomainAdapter = {
  id: "regulation-guide",
  title: "행사 절차 안내 도우미 (연습용 가상 규정)",
  tagline: "행사 일정·예산을 연습용 가상 규정에 대조해 신청 기한·검토자·결과보고 마감을 안내합니다",
  user: "비교과 행사를 준비하는 부서 담당자",
  input: {
    label: "행사 계획 CSV",
    help: "열: 행사명, 신청일, 시작일, 종료일, 예산. 날짜는 YYYY-MM-DD.",
    placeholder: "행사명,신청일,시작일,종료일,예산\n겨울 코딩 캠프,2026-11-20,2026-12-10,2026-12-10,300000",
    accept: ".csv,text/csv",
  },
  samples: [
    { id: "normal", label: "정상 샘플", description: "행사 3건", content: regulationNormalCsv },
    { id: "errors", label: "오류 샘플", description: "없는 날짜·역전된 기간·예산 오류", content: regulationErrorCsv },
    { id: "boundary", label: "경계값 샘플", description: "정확히 7일 전·정확히 50만원", content: regulationBoundaryCsv },
  ],
  analyze: analyzeRegulationCsv,
  ai: {
    system:
      "당신은 행사 담당자에게 내부 절차를 안내하는 보조자입니다. 규정 판단은 이미 코드가 했으므로 그 결과를 쉬운 문장으로 설명합니다. 모든 규정은 연습용 가상 규정임을 밝힙니다.",
    instruction:
      "행사별로 해야 할 절차(신청 기한, 검토자, 결과보고 마감)를 안내하는 초안을 작성하세요. 기한 미충족 행사는 먼저 알리고, 각 섹션에 규정 ID와 행사 근거 ID를 연결하세요.",
  },
  report: { title: "행사 절차 안내(초안, 연습용 가상 규정)", filename: "event-procedure-guide.md" },
};
