// Kiro가 돌려주는 구조화 결과의 스키마와 코드 검증. 형식이 맞아도 규칙(개수·근거 ID·안전성)은 코드가 다시 판정한다.
import { z } from "zod";

const s = (max: number) => z.string().max(max);

/**
 * 표시용 목록의 개수 상한. 모델이 상한보다 많이 주면 앞에서부터 상한까지만 쓴다.
 * j_ffefff1abb396176 시도 2에서 howItWorks 7개(상한 6) 하나 때문에 응답 전체가 invalid_output → 재시도됐다.
 * 문자열 길이·필수 항목·규칙 판정 대상(ideas 개수)은 그대로 엄격하게 본다.
 */
const list = <T extends z.ZodTypeAny>(item: T, max: number, min = 0) =>
  z.preprocess((v) => (Array.isArray(v) && v.length > max ? v.slice(0, max) : v), z.array(item).min(min).max(max));

export const SourceRefSchema = z.object({
  id: z.string().regex(/^S\d{1,2}$/),
  title: s(300),
  url: z.string().url().max(2048),
  publishedAt: s(40).nullable().optional(),
});

// ---- W1/W2 개념 조사 ----
export const ConceptResearchSchema = z.object({
  term: s(120),
  ambiguity: z.object({
    isAmbiguous: z.boolean(),
    meanings: list(s(200), 5),
    /** 핵심 의미를 특정할 수 없을 때만 채운다 → needs_input */
    blockingQuestion: s(300).nullable(),
    chosenInterpretation: s(300).nullable(),
  }),
  oneLine: s(400),
  example: s(600),
  howItWorks: list(s(600), 6, 1),
  keyTerms: list(z.object({ term: s(80), meaning: s(300) }), 8),
  history: list(z.object({ when: s(40), event: s(400), sourceIds: list(s(4), 4) }), 6),
  canDo: list(s(300), 6),
  hardYet: list(s(300), 6),
  recentResearch: list(
    z.object({
      title: s(300),
      authors: s(300),
      date: s(40),
      venue: s(200),
      kind: z.enum(["peer_reviewed", "preprint", "unknown"]),
      contribution: s(500),
      limitation: s(400),
      sourceId: s(4),
    }),
    3,
  ),
  recentResearchNote: s(400).nullable(),
  experiment: s(600),
  searchScope: s(400),
  sources: list(SourceRefSchema, 8),
  highlights: list(s(200), 3, 1),
  nextAction: s(300),
});
export type ConceptResearch = z.infer<typeof ConceptResearchSchema>;

// ---- W3 아이디어 5개 ----
export const AXES = ["who", "when", "scale", "method"] as const;
export const IdeaReportSchema = z.object({
  seed: s(400),
  coreFunction: s(400),
  defaults: list(s(200), 10, 1),
  ideas: z
    .array(
      z.object({
        name: s(80),
        targetUser: s(200),
        problem: s(300),
        howItWorks: s(600),
        scene: s(400),
        smallestExperiment: s(400),
        keyAssumption: s(300),
        risk: s(300),
        axesChanged: list(z.enum(AXES), 4),
        differenceFromOthers: s(400),
      }),
    )
    .max(8),
  highlights: list(s(200), 3, 1),
  nextAction: s(300),
});
export type IdeaReport = z.infer<typeof IdeaReportSchema>;

/** W3 완료 기준: 정확히 5개, 이름 중복 없음, 각 아이디어가 기본값 대비 2개 축 이상 변경(AC-08) */
export function checkIdeas(report: IdeaReport): string[] {
  const problems: string[] = [];
  if (report.ideas.length !== 5) problems.push(`아이디어가 ${report.ideas.length}개입니다(정확히 5개 필요).`);
  const names = report.ideas.map((i) => i.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) problems.push("이름이 같은 아이디어가 있습니다.");
  report.ideas.forEach((idea, i) => {
    const axes = new Set(idea.axesChanged);
    if (axes.size < 2) problems.push(`${i + 1}번 "${idea.name}"은 바꾼 축이 ${axes.size}개입니다(2개 이상 필요).`);
  });
  return problems;
}

// ---- W4 원페이지 체험 ----
export const PrototypeSchema = z.object({
  interpretation: s(400),
  targetUser: s(200),
  problem: s(300),
  coreAction: s(300),
  title: s(120),
  html: z.string().min(200).max(150_000),
  howToTry: list(s(200), 5, 1),
  highlights: list(s(200), 3, 1),
  nextAction: s(300),
});
export type Prototype = z.infer<typeof PrototypeSchema>;

/** 생성 HTML 정적 점검: 상호작용 요소·스크립트 존재, 외부 리소스·네트워크 호출 금지(AC-09 보조) */
export function checkPrototypeHtml(html: string): string[] {
  const problems: string[] = [];
  const lower = html.toLowerCase();
  if (!/<script[\s>]/.test(lower)) problems.push("스크립트가 없어 상호작용이 동작할 수 없습니다.");
  if (!/<(button|input|select|textarea)[\s>]/.test(lower)) problems.push("누를 수 있는 입력 요소(button·input·select)가 없습니다.");
  if (/(src|href)\s*=\s*["']?\s*(https?:)?\/\//.test(lower)) problems.push("외부 리소스(src/href=http…)를 불러옵니다.");
  if (/@import\s+url\(|url\(\s*["']?https?:/.test(lower)) problems.push("CSS에서 외부 리소스를 불러옵니다.");
  if (/\b(fetch|xmlhttprequest|websocket|eventsource|sendbeacon)\s*\(/.test(lower) || /new\s+(websocket|eventsource|xmlhttprequest)/.test(lower)) {
    problems.push("네트워크 호출 코드가 있습니다.");
  }
  if (/document\.cookie|localstorage|sessionstorage|indexeddb/.test(lower)) problems.push("브라우저 저장소·쿠키에 접근합니다.");
  if (/window\.(parent|top|opener)|parent\.postmessage/.test(lower)) problems.push("상위 창에 접근합니다.");
  return problems;
}

// ---- W5 요약 ----
export const SummarySchema = z.object({
  title: s(300),
  overview: s(1200),
  keyPoints: list(s(400), 8, 1),
  analysis: s(1500),
  chapters: list(z.object({ start: s(12).nullable(), title: s(200), summary: s(600) }), 15),
  /** 장면 캡처를 붙일 시각(초). 자막에 근거한 시각만 */
  sceneSeconds: list(z.number().int().min(0).max(24 * 3600), 8).default([]),
  highlights: list(s(200), 3, 1),
  nextAction: s(300),
});
export type Summary = z.infer<typeof SummarySchema>;

/** Kiro 출력에서 <<<JSON … JSON>>> 사이의 객체를 꺼낸다 */
export function extractJson(text: string): unknown {
  const start = text.lastIndexOf("<<<JSON");
  const end = text.lastIndexOf("JSON>>>");
  let body: string | null = null;
  if (start !== -1 && end > start) body = text.slice(start + 7, end);
  else {
    const fence = text.match(/```json\s*([\s\S]*?)```/);
    if (fence) body = fence[1];
  }
  if (body === null) throw new Error("no_json_block");
  // 실행 로그 줄([tool] …, [INFO] …)이 블록 안에 끼어도 첫 { ~ 마지막 } 만 읽는다
  const cleaned = body
    .split(/\r?\n/)
    .filter((line) => !/^\s*\[(tool|INFO|WARN|DEBUG)\]/.test(line))
    .join("\n");
  const open = cleaned.indexOf("{");
  const close = cleaned.lastIndexOf("}");
  if (open === -1 || close < open) throw new Error("no_json_block");
  return JSON.parse(cleaned.slice(open, close + 1));
}
