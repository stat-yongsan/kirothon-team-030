// 샘플 모드 전용 고정 데이터. 실제 조사·생성 결과가 아니며 화면과 HTML에 "샘플" 배지를 붙인다.
// 샘플 작업은 같은 검증·렌더링 경로를 지나지만 Kiro 호출·URL 접속·외부 쓰기를 하지 않는다(AC-20).
import type { ConceptResearch, IdeaReport, Prototype, Summary } from "./outputs.ts";
import type { ScheduleExtraction } from "./schedule.ts";
import type { OutputKind, Purpose } from "./contracts.ts";

export interface SampleCapture {
  id: string;
  label: string;
  purpose: Purpose;
  output: OutputKind;
  text?: string;
  url?: string;
}

export const SAMPLE_CAPTURES: SampleCapture[] = [
  { id: "concept", label: "개념잡기", purpose: "concept", output: "html", text: "회의에서 들은 RAG. 우리 팀 문서 검색에 쓸 수 있나?" },
  { id: "idea", label: "아이디어 확장하기", purpose: "idea", output: "html", text: "직장인 점심 메뉴 고르는 데 매일 10분씩 쓴다. 이걸 줄이는 서비스" },
  { id: "proto", label: "체험: 점심 메뉴 고르기", purpose: "idea", output: "prototype", text: "인원·예산·못 먹는 음식을 넣으면 오늘 점심 후보가 바로 좁혀지는 페이지" },
  { id: "schedule", label: "일정잡기", purpose: "schedule", output: "calendar", text: "AI 실무 세미나\n일시: 2026년 11월 20일(금) 15:00–17:00\n장소: 본관 3층 대회의실\n사전 신청 마감: 11월 18일 18:00" },
  { id: "bad", label: "잘못된 조합: 요약 + 메모만", purpose: "summary", output: "html", text: "URL 없이 요약을 요청한 예" },
];

export const SAMPLE_CONCEPT: ConceptResearch = {
  term: "RAG (Retrieval-Augmented Generation)",
  ambiguity: { isAmbiguous: true, meanings: ["검색 증강 생성(AI)", "RAG 상태 표시(Red-Amber-Green, 프로젝트 관리)"], blockingQuestion: null, chosenInterpretation: "회의 맥락상 AI의 검색 증강 생성으로 해석했습니다." },
  oneLine: "[샘플] 답하기 전에 관련 문서를 먼저 찾아 근거로 붙이는 생성 방식입니다.",
  example: "사내 규정 질문에 규정 문서 조각을 찾아 함께 넣고 답하게 하는 것.",
  howItWorks: ["질문과 비슷한 문서 조각을 검색합니다.", "찾은 조각을 질문과 함께 모델에 넣습니다.", "모델이 조각을 근거로 답하고 출처를 표시합니다."],
  keyTerms: [{ term: "임베딩", meaning: "문장을 비교 가능한 숫자 벡터로 바꾼 것" }],
  history: [{ when: "2020", event: "검색과 생성을 결합한 RAG 논문 발표(샘플 표기)", sourceIds: ["S1"] }],
  canDo: ["문서 근거가 있는 답변", "모델 재학습 없이 최신 문서 반영"],
  hardYet: ["검색이 틀리면 답도 틀림", "표·이미지 많은 문서"],
  recentResearch: [],
  recentResearchNote: "샘플 모드라 실제 논문 검색을 하지 않았습니다.",
  experiment: "팀 FAQ 10개로 '문서 찾기 → 답하기'를 손으로 흉내 내고 답이 근거를 따르는지 확인하기.",
  searchScope: "샘플 모드: 검색하지 않음",
  sources: [{ id: "S1", title: "[샘플] 출처 자리표시", url: "https://example.com/sample-source", publishedAt: null }],
  highlights: ["[샘플] RAG는 '찾고 나서 답하기'입니다.", "팀 문서 검색에 바로 시험할 수 있습니다.", "검색 품질이 답 품질을 좌우합니다."],
  nextAction: "팀 FAQ 10개로 30분 실험하기",
};

const idea = (name: string, who: string, axes: IdeaReport["ideas"][number]["axesChanged"], how: string): IdeaReport["ideas"][number] => ({
  name,
  targetUser: who,
  problem: "매일 점심 메뉴를 고르는 데 시간이 든다",
  howItWorks: how,
  scene: "11시 50분 메신저 단톡방",
  smallestExperiment: "팀 4명과 1주일 시험",
  keyAssumption: "결정 시간을 줄이고 싶어 한다",
  risk: "취향이 자주 바뀐다",
  axesChanged: axes,
  differenceFromOthers: `${name}은(는) 다른 안과 대상·방식이 다릅니다.`,
});

export const SAMPLE_IDEAS: IdeaReport = {
  seed: "[샘플] 직장인 점심 메뉴 결정 시간 줄이기",
  coreFunction: "여럿이 빠르게 합의할 수 있는 후보를 좁힌다",
  defaults: ["메뉴 추천 앱", "룰렛 돌리기", "맛집 지도", "투표 기능"],
  ideas: [
    idea("싫은 것부터", "팀 점심 4–6명", ["who", "method"], "각자 못 먹는 것만 비공개로 내고 남은 후보만 보여줌"),
    idea("전날 밤 예약", "혼밥 직장인", ["when", "method"], "전날 밤 내일 점심을 한 번에 정해 아침 알림"),
    idea("구내식당 연동판", "사내 식당 운영자", ["who", "scale"], "식당이 남는 재고 메뉴를 할인 후보로 내놓음"),
    idea("주간 식단 계약", "다이어트 중인 직장인", ["when", "scale"], "월요일에 주 5일 메뉴를 정해 두고 매일은 고르지 않음"),
    idea("엘리베이터 투표", "같은 층 사람들", ["who", "method"], "엘리베이터 앞 QR 하나로 층 전체 점심 모임 결성"),
  ],
  highlights: ["[샘플] '싫은 것 먼저'가 합의를 빠르게 합니다.", "결정 시점을 전날 밤으로 옮길 수 있습니다.", "대상을 식당 쪽으로 바꾼 안도 있습니다."],
  nextAction: "팀 단톡방에서 '싫은 것부터' 방식으로 내일 점심 정해 보기",
};

export const SAMPLE_PROTOTYPE: Prototype = {
  interpretation: "[샘플] 팀 점심 후보를 조건으로 좁히는 체험으로 해석했습니다.",
  targetUser: "팀 점심을 정하는 직장인",
  problem: "메뉴 합의에 시간이 든다",
  coreAction: "조건을 바꾸면 후보 목록이 바로 바뀐다",
  title: "오늘 점심 좁히기",
  html: `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>오늘 점심 좁히기</title>
<style>body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#fff8ef;color:#222}h1{font-size:20px}label{display:block;margin:8px 0}.c{border:1px solid #ddd;border-radius:10px;padding:8px;margin:6px 0;background:#fff}.n{color:#a33}</style></head>
<body><h1>오늘 점심 좁히기</h1><p class="n">가상 샘플 데이터입니다.</p>
<label>인원 <input id="p" type="number" min="1" max="10" value="4"></label>
<label>1인 예산(원) <input id="b" type="number" step="1000" value="10000"></label>
<label><input id="s" type="checkbox"> 매운 음식 제외</label>
<button id="go">후보 보기</button><div id="out" role="status"></div>
<script>
var M=[{n:"김치찌개",p:9000,s:1,max:6},{n:"쌀국수",p:11000,s:0,max:8},{n:"제육덮밥",p:9500,s:1,max:10},{n:"샐러드",p:12000,s:0,max:4},{n:"칼국수",p:8500,s:0,max:10}];
function show(){var p=+document.getElementById('p').value,b=+document.getElementById('b').value,s=document.getElementById('s').checked;
var r=M.filter(function(m){return m.p<=b&&(!s||!m.s)&&p<=m.max;});
document.getElementById('out').innerHTML=r.length?r.map(function(m){return '<div class="c">'+m.n+' · '+m.p.toLocaleString()+'원</div>'}).join(''):'<p>조건에 맞는 후보가 없습니다. 예산을 늘려 보세요.</p>';}
document.getElementById('go').addEventListener('click',show);show();
</script></body></html>`,
  howToTry: ["예산을 9000으로 바꾸고 '후보 보기'", "'매운 음식 제외'를 켜고 다시 보기"],
  highlights: ["[샘플] 조건 3개로 후보가 바로 좁혀집니다."],
  nextAction: "팀원 2명에게 링크를 보여주고 조건이 충분한지 묻기",
};

export const SAMPLE_SUMMARY: Summary = {
  title: "[샘플] 웹페이지 요약",
  overview: "샘플 모드 요약입니다. 실제 페이지를 읽지 않았습니다.",
  keyPoints: ["샘플 핵심 포인트"],
  analysis: "샘플 분석",
  chapters: [],
  sceneSeconds: [],
  highlights: ["[샘플] 실제 요약이 아닙니다."],
  nextAction: "실제 링크로 다시 맡기기",
};

export const SAMPLE_SCHEDULE: ScheduleExtraction = {
  candidates: [
    { kind: "event", title: "AI 실무 세미나", date: "2026-11-20", yearStated: true, startTime: "15:00", endTime: "17:00", timezone: null, location: "본관 3층 대회의실", excerpt: "일시: 2026년 11월 20일(금) 15:00–17:00" },
    { kind: "deadline", title: "사전 신청 마감", date: "2026-11-18", yearStated: false, startTime: "18:00", endTime: null, timezone: null, location: null, excerpt: "사전 신청 마감: 11월 18일 18:00" },
  ],
  notes: [],
};
