import Papa from "papaparse";
import type { Issue } from "./types";

export interface CsvRow {
  /** 원본 파일 기준 시작 행 번호(헤더 = 1행) */
  line: number;
  cells: Record<string, string>;
}

export interface ParsedCsv {
  headers: string[];
  rows: CsvRow[];
  issues: Issue[];
}

/**
 * 검증된 파서(Papaparse)로 CSV를 읽는다.
 * - BOM 제거, CRLF/CR → LF 정규화 후 파싱(혼합 줄바꿈 오판 방지)
 * - 따옴표 안 쉼표·줄바꿈 처리, 실제 시작 행 번호 계산
 * - 빈 줄은 건너뛰되 행 번호는 유지
 * - 중복 열 이름, 열 개수가 다른 행, 이름 없는 열의 값은 오류(값을 버리거나 덮어쓰지 않음)
 */
export function parseCsv(raw: string, requiredHeaders: string[]): ParsedCsv {
  const text = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const issues: Issue[] = [];
  const records: { line: number; data: string[] }[] = [];

  // 이전 행 끝(start)부터 이번 행 끝까지의 줄바꿈만 세어 행 번호를 누적한다(전체 길이에 비례).
  let start = 0;
  let nextLine = 1;
  Papa.parse<string[]>(text, {
    delimiter: ",",
    newline: "\n",
    skipEmptyLines: false,
    step: (result) => {
      const line = nextLine;
      for (; start < result.meta.cursor; start++) if (text.charCodeAt(start) === 10) nextLine++;
      for (const err of result.errors) {
        issues.push({
          severity: "error",
          line,
          message: `CSV 형식 오류(${err.code}): 따옴표나 구분자를 확인하세요`,
        });
      }
      const data = result.data;
      const isBlank = data.length === 0 || (data.length === 1 && data[0].trim() === "");
      if (!isBlank) records.push({ line, data });
    },
  });

  if (records.length === 0) {
    issues.push({ severity: "error", message: "CSV 내용이 비어 있습니다" });
    return { headers: [], rows: [], issues };
  }

  const [headerRecord, ...dataRecords] = records;
  const headers = headerRecord.data.map((h) => h.trim());

  const missing = requiredHeaders.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    issues.push({
      severity: "error",
      line: headerRecord.line,
      message: `필수 열 누락: ${missing.join(", ")} (필요한 열: ${requiredHeaders.join(", ")})`,
    });
  }
  const duplicated = [...new Set(headers.filter((h, i) => h !== "" && headers.indexOf(h) !== i))];
  if (duplicated.length > 0) {
    issues.push({
      severity: "error",
      line: headerRecord.line,
      message: `같은 이름의 열이 여러 개입니다: ${duplicated.join(", ")}`,
    });
  }
  const extra = headers.filter((h) => h !== "" && !requiredHeaders.includes(h));
  if (extra.length > 0) {
    issues.push({
      severity: "warning",
      line: headerRecord.line,
      message: `사용하지 않는 열은 무시합니다: ${extra.join(", ")}`,
    });
  }

  // 열 개수가 다르면 값이 버려지거나 다른 열로 밀리므로 그 행은 집계에 넣지 않고 오류로 보고한다.
  const rows: CsvRow[] = [];
  for (const { line, data } of dataRecords) {
    if (data.length !== headers.length) {
      issues.push({
        severity: "error",
        line,
        message: `열 개수가 헤더와 다릅니다 (헤더 ${headers.length}개, 값 ${data.length}개). 쉼표가 든 값은 큰따옴표로 감싸세요`,
      });
      continue;
    }
    if (data.some((v, i) => headers[i] === "" && v.trim() !== "")) {
      issues.push({ severity: "error", line, message: "이름 없는 열에 값이 있습니다. 헤더에 열 이름을 넣거나 값을 지우세요" });
      continue;
    }
    const cells: Record<string, string> = {};
    headers.forEach((h, i) => {
      cells[h] = data[i].trim();
    });
    rows.push({ line, cells });
  }

  if (dataRecords.length === 0 && missing.length === 0) {
    issues.push({ severity: "error", message: "헤더만 있고 데이터 행이 없습니다" });
  }

  return { headers, rows, issues };
}

/** "1,200,000" 같은 천 단위 구분 쉼표를 허용하는 0 이상의 정수. 그 외는 null */
export function parseNonNegativeInt(value: string): number | null {
  const v = value.trim();
  if (!/^(\d+|\d{1,3}(,\d{3})+)$/.test(v)) return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isSafeInteger(n) ? n : null;
}
