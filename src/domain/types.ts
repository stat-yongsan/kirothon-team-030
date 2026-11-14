// 공통 엔진 계약. 주제가 바뀌어도 이 파일은 가능한 한 유지한다.
// 주제별 코드는 DomainAdapter 하나를 구현하고 src/domain/current.ts에서 연결한다.

export type Severity = "error" | "warning";

export interface Issue {
  severity: Severity;
  /** 입력 파일의 실제 행 번호(헤더 = 1행). 행과 무관한 문제면 생략 */
  line?: number;
  field?: string;
  message: string;
}

export interface Metric {
  id: string;
  label: string;
  value: string;
  note?: string;
}

export interface TableColumn {
  key: string;
  label: string;
  align?: "left" | "right";
}

export interface TableData {
  caption: string;
  columns: TableColumn[];
  rows: { id: string; cells: Record<string, string> }[];
}

/** Claude가 인용할 수 있는 검증된 사실. id는 응답 검증에 쓰인다. */
export interface Evidence {
  id: string;
  label: string;
  value: string;
  source: string;
}

export interface Analysis {
  issues: Issue[];
  metrics: Metric[];
  /** 오류가 있을 때 집계에 대한 안내(예: 오류 행 제외 참고값) */
  metricsNote?: string;
  table: TableData | null;
  evidence: Evidence[];
  /** 오류가 없고 근거가 있을 때만 AI 초안을 요청할 수 있다 */
  canDraft: boolean;
}

export interface Sample {
  id: string;
  label: string;
  description: string;
  content: string;
}

export interface DomainAdapter {
  id: string;
  title: string;
  tagline: string;
  /** 핵심 사용자 1명 */
  user: string;
  input: {
    label: string;
    help: string;
    placeholder: string;
    /** <input type="file" accept> 값 */
    accept: string;
  };
  /** 정상(초안 가능) 샘플과 오류 샘플을 각각 1개 이상 포함한다. API 경계 테스트가 이를 사용한다. */
  samples: Sample[];
  /** 순수 함수. 클라이언트(즉시 표시)와 서버(프롬프트 근거) 양쪽에서 같은 결과를 낸다 */
  analyze(raw: string): Analysis;
  ai: {
    /** 도메인 역할·문체 지침. 공통 안전 지침은 엔진이 덧붙인다 */
    system: string;
    /** 이번 초안에서 요청할 내용 */
    instruction: string;
  };
  report: {
    title: string;
    filename: string;
  };
}

export function hasErrors(issues: Issue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
