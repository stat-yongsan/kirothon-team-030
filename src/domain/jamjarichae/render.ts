// 신뢰된 HTML 템플릿. 모델 출력은 모두 이스케이프해 텍스트로만 넣는다(스크립트 없음).
import { JOB_STATUS_LABEL, workflowSpec, PURPOSE_LABEL, type JobStatus, type Workflow } from "./contracts.ts";
import type { Source } from "./job.ts";
import type { ConceptResearch, IdeaReport, Summary } from "./outputs.ts";
import type { ScheduleDecision } from "./schedule.ts";

export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** http/https만 링크로 만든다 */
function link(url: string, label?: string): string {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return esc(label ?? url);
    return `<a href="${esc(u.toString())}" rel="noopener noreferrer" target="_blank">${esc(label ?? url)}</a>`;
  } catch {
    return esc(label ?? url);
  }
}

const list = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "<p class=muted>없음</p>");

export interface ShellMeta {
  title: string;
  workflow: Workflow;
  status: JobStatus;
  sample: boolean;
  engine: string;
  captureDate: string;
  generatedAt: string;
  input: { text: string | null; url: string | null; hasImage: boolean };
  highlights: string[];
  nextAction?: string;
  assumptions: string[];
  coverageNotes: string[];
  sources: Source[];
}

const CSS = `
:root{color-scheme:light;--ink:#14213d;--muted:#5b6478;--line:#d9deea;--night:#1b2a4e;--dawn:#f4a259}
*{box-sizing:border-box}body{margin:0;font-family:"Pretendard","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",system-ui,sans-serif;color:var(--ink);background:#f6f7fb;line-height:1.65}
header{background:var(--night);color:#fff;padding:24px 20px}header .brand{font-size:13px;opacity:.85}header h1{margin:6px 0 8px;font-size:24px;line-height:1.35;word-break:keep-all}
.badges span{display:inline-block;margin:4px 6px 0 0;padding:2px 10px;border-radius:999px;font-size:12px;background:#ffffff22;border:1px solid #ffffff55}
.badges .sample{background:#fde68a;color:#713f12;border-color:#f59e0b}
main{max-width:860px;margin:0 auto;padding:20px}section{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:0 0 16px}
h2{font-size:18px;margin:0 0 10px}h3{font-size:16px;margin:14px 0 6px}.muted{color:var(--muted)}.lead{font-size:17px}
.brief{border-left:6px solid var(--dawn)}table{border-collapse:collapse;width:100%;font-size:14px}td,th{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
.wrap{overflow-x:auto}.card{border:1px solid var(--line);border-radius:12px;padding:14px;margin:10px 0}.tag{font-size:12px;padding:1px 8px;border-radius:999px;background:#eef2ff;margin-right:4px}
.ok{color:#166534}.warn{color:#9a3412}figure{margin:10px 0}figure img{max-width:100%;border-radius:8px;border:1px solid var(--line)}
a{color:#1d4ed8;word-break:break-all}footer{max-width:860px;margin:0 auto;padding:0 20px 30px;font-size:12px;color:var(--muted)}
`;

export function shell(meta: ShellMeta, body: string): string {
  const spec = workflowSpec(meta.workflow);
  const srcRows = meta.sources
    .map(
      (s) =>
        `<tr><td>${esc(s.id)}</td><td>${link(s.url, s.title)}</td><td>${esc(s.publishedAt ?? "—")}</td><td>${
          s.reachable === true
            ? `<span class=ok>응답 확인(${esc(s.httpStatus)})</span>`
            : s.reachable === false
              ? `<span class=warn>응답 없음${s.httpStatus ? `(${esc(s.httpStatus)})` : ""}</span>`
              : "미확인"
        }</td><td>${esc(s.accessedAt.slice(0, 10))}</td></tr>`,
    )
    .join("");
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(meta.title)} · 잠자리채</title><style>${CSS}</style></head>
<body>
<header><div class="brand">잠자리채 · 날아가는 생각, 잠자리에서 잡아드립니다</div>
<h1>${esc(meta.title)}</h1>
<div class="badges"><span>${esc(spec.code)} ${esc(PURPOSE_LABEL[spec.purpose])} · ${esc(spec.outputLabel)}</span><span>상태: ${esc(JOB_STATUS_LABEL[meta.status])}</span>
<span>입력 날짜 ${esc(meta.captureDate)}</span><span>생성 엔진: ${esc(meta.engine)}</span>${meta.sample ? '<span class="sample">샘플 결과 · 실제 조사 아님</span>' : ""}</div></header>
<main>
<section class="brief"><h2>아침 브리핑</h2>${list(meta.highlights)}${meta.nextAction ? `<p><strong>다음 행동</strong> ${esc(meta.nextAction)}</p>` : ""}</section>
${body}
<section><h2>분석 범위와 가정</h2><h3>가정</h3>${list(meta.assumptions)}<h3>분석 범위·한계</h3>${list(meta.coverageNotes)}
<h3>원래 입력</h3><p class="muted">${meta.input.text ? esc(meta.input.text) : "(메모 없음)"}${meta.input.url ? `<br>URL: ${link(meta.input.url)}` : ""}${meta.input.hasImage ? "<br>이미지 1장 첨부" : ""}</p></section>
<section><h2>출처</h2>${meta.sources.length ? `<div class="wrap"><table><thead><tr><th>ID</th><th>제목</th><th>발행</th><th>접속 확인(코드)</th><th>확인일</th></tr></thead><tbody>${srcRows}</tbody></table></div>` : '<p class="muted">출처 없음</p>'}</section>
</main>
<footer>생성 ${esc(meta.generatedAt)} · 이 문서는 사용자 검토 전 초안입니다. 접속 확인은 URL이 응답했는지만 뜻하며 내용의 정확성을 보증하지 않습니다.</footer>
</body></html>`;
}

export function conceptBody(r: ConceptResearch): string {
  const research = r.recentResearch.length
    ? r.recentResearch
        .map(
          (p) => `<div class="card"><strong>${esc(p.title)}</strong> <span class="tag">${
            p.kind === "peer_reviewed" ? "심사 논문" : p.kind === "preprint" ? "프리프린트" : "종류 미확인"
          }</span><br><span class="muted">${esc(p.authors)} · ${esc(p.date)} · ${esc(p.venue)} · 근거 ${esc(p.sourceId)}</span>
<p><strong>기여</strong> ${esc(p.contribution)}</p><p><strong>한계</strong> ${esc(p.limitation)}</p></div>`,
        )
        .join("")
    : `<p class="muted">${esc(r.recentResearchNote ?? "적합한 최근 논문을 찾지 못했습니다.")}</p>`;
  return `
<section><h2>한 문장 정의</h2><p class="lead">${esc(r.oneLine)}</p><p><strong>쉬운 예시</strong> ${esc(r.example)}</p>
${r.ambiguity.chosenInterpretation ? `<p class="muted">해석 가정: ${esc(r.ambiguity.chosenInterpretation)}</p>` : ""}</section>
<section><h2>어떻게 작동하나</h2>${list(r.howItWorks)}${
    r.keyTerms.length ? `<h3>필요한 용어</h3><ul>${r.keyTerms.map((k) => `<li><strong>${esc(k.term)}</strong> — ${esc(k.meaning)}</li>`).join("")}</ul>` : ""
  }</section>
<section><h2>언제·왜 등장했나</h2>${
    r.history.length ? `<ul>${r.history.map((h) => `<li><strong>${esc(h.when)}</strong> ${esc(h.event)} <span class="muted">[${esc(h.sourceIds.join(", "))}]</span></li>`).join("")}</ul>` : '<p class="muted">검증된 이정표 없음</p>'
  }</section>
<section><h2>지금 가능한 것 / 아직 어려운 것</h2><div class="wrap"><table><tr><th>가능</th><th>어려움</th></tr><tr><td>${list(r.canDo)}</td><td>${list(r.hardYet)}</td></tr></table></div></section>
<section><h2>최근 연구</h2>${research}</section>
<section><h2>작은 실험 1개</h2><p>${esc(r.experiment)}</p><p class="muted">검색 범위: ${esc(r.searchScope)}</p></section>`;
}

const AXIS_LABEL: Record<string, string> = { who: "대상", when: "시점", scale: "규모", method: "방식" };

export function ideaBody(r: IdeaReport): string {
  return `
<section><h2>씨앗과 핵심 기능</h2><p>${esc(r.seed)}</p><p><strong>이뤄야 할 기능</strong> ${esc(r.coreFunction)}</p>
<h3>흔한 접근(기본값)</h3>${list(r.defaults)}</section>
<section><h2>서로 다른 아이디어 ${r.ideas.length}개</h2>${r.ideas
    .map(
      (i, n) => `<div class="card"><h3>${n + 1}. ${esc(i.name)}</h3><p>${i.axesChanged.map((a) => `<span class="tag">${esc(AXIS_LABEL[a] ?? a)} 변경</span>`).join("")}</p>
<div class="wrap"><table>
<tr><th>대상</th><td>${esc(i.targetUser)}</td></tr><tr><th>불편</th><td>${esc(i.problem)}</td></tr>
<tr><th>작동 방식</th><td>${esc(i.howItWorks)}</td></tr><tr><th>사용 장면</th><td>${esc(i.scene)}</td></tr>
<tr><th>가장 작은 실험</th><td>${esc(i.smallestExperiment)}</td></tr><tr><th>핵심 가정</th><td>${esc(i.keyAssumption)}</td></tr>
<tr><th>위험·약점</th><td>${esc(i.risk)}</td></tr><tr><th>다른 안과의 차이</th><td>${esc(i.differenceFromOthers)}</td></tr></table></div></div>`,
    )
    .join("")}</section>`;
}

export function summaryBody(r: Summary, scenes: { seconds: number; src: string; label: string }[], videoUrl: string | null): string {
  const chapters = r.chapters.length
    ? `<ol>${r.chapters.map((c) => `<li>${c.start ? `<strong>${esc(c.start)}</strong> ` : ""}${esc(c.title)} — ${esc(c.summary)}</li>`).join("")}</ol>`
    : '<p class="muted">목차 없음</p>';
  const sceneHtml = scenes.length
    ? scenes
        .map((s) => {
          const t = `${Math.floor(s.seconds / 60)}:${String(s.seconds % 60).padStart(2, "0")}`;
          const href = videoUrl ? `${videoUrl}${videoUrl.includes("?") ? "&" : "?"}t=${s.seconds}s` : null;
          return `<figure><img src="${esc(s.src)}" alt="${esc(t)} 장면"><figcaption>${href ? link(href, `${t} 원본 시점`) : esc(t)} · ${esc(s.label)}</figcaption></figure>`;
        })
        .join("")
    : "";
  return `
<section><h2>요약</h2><p class="lead">${esc(r.overview)}</p></section>
<section><h2>핵심 포인트</h2>${list(r.keyPoints)}</section>
<section><h2>분석</h2><p>${esc(r.analysis)}</p></section>
<section><h2>시간순 목차</h2>${chapters}</section>
${sceneHtml ? `<section><h2>실제 장면 캡처</h2>${sceneHtml}</section>` : ""}`;
}

export function scheduleBody(d: ScheduleDecision): string {
  if (!d.event) return `<section><h2>확인 필요</h2><p>${esc(d.question)}</p>${list(d.notes)}</section>`;
  const e = d.event;
  return `
<section><h2>등록할 일정(코드 판정)</h2><div class="wrap"><table>
<tr><th>제목</th><td>${esc(e.title)}</td></tr><tr><th>날짜</th><td>${esc(e.date)}</td></tr>
<tr><th>시간</th><td>${esc(e.startTime)}–${esc(e.endTime)} (${esc(e.timeZone)})</td></tr>
<tr><th>장소</th><td>${esc(e.location ?? "원문에 없음")}</td></tr><tr><th>원문 근거</th><td>${esc(e.excerpt)}</td></tr>
<tr><th>알림</th><td>${d.reminders.map((r) => `${esc(r.label)}(${r.minutes}분 전)${r.alreadyPassed ? " — 이미 지남" : ""}`).join("<br>")}</td></tr>
</table></div><h3>메모</h3>${list(d.notes)}</section>`;
}
