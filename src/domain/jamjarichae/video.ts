// W2 영상: 조사 결과(ConceptResearch)를 HyperFrames 구성(HTML)으로 바꾼다. 장면 수·길이·글자 수 상한은 코드가 정하고,
// 모델이 돌려준 문장은 이스케이프해서 데이터로만 넣는다. 숫자(장면 길이)는 항목 수에서 계산한다.
import type { ConceptResearch } from "./outputs.ts";

export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;
export const VIDEO_FPS = 30;

export interface VideoScene {
  id: string;
  kicker: string;
  heading: string;
  /** 본문 줄. 장면마다 최대 4줄 */
  lines: { label?: string; text: string }[];
  durationSec: number;
}

export interface VideoPlan {
  scenes: VideoScene[];
  totalSec: number;
  sample: boolean;
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** 슬라이드에 들어갈 길이로 자른다. 잘리면 말줄임표를 붙인다 */
export function cut(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  const chars = [...t];
  return chars.length <= max ? t : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}

/** 장면 길이: 기본 4초 + 줄마다 1.5초, 5–9초 */
export function sceneDuration(lineCount: number): number {
  return Math.min(9, Math.max(5, 4 + 1.5 * lineCount));
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const KIND_LABEL = { peer_reviewed: "심사 논문", preprint: "프리프린트", unknown: "유형 미확인" } as const;

export function planVideo(r: ConceptResearch, opts: { sample: boolean }): VideoPlan {
  const raw: Omit<VideoScene, "durationSec" | "id">[] = [];
  raw.push({ kicker: opts.sample ? "개념알기 · 샘플" : "개념알기", heading: cut(r.term, 40), lines: [{ text: cut(r.oneLine, 120) }] });
  if (r.example.trim()) raw.push({ kicker: "예를 들면", heading: "쉬운 예시", lines: [{ text: cut(r.example, 160) }] });
  if (r.howItWorks.length)
    raw.push({ kicker: "원리", heading: "어떻게 동작할까", lines: r.howItWorks.slice(0, 4).map((t, i) => ({ label: String(i + 1), text: cut(t, 90) })) });
  if (r.keyTerms.length)
    raw.push({ kicker: "용어", heading: "핵심 용어", lines: r.keyTerms.slice(0, 4).map((k) => ({ label: cut(k.term, 18), text: cut(k.meaning, 80) })) });
  if (r.history.length)
    raw.push({ kicker: "역사", heading: "이렇게 발전했어요", lines: r.history.slice(0, 4).map((h) => ({ label: cut(h.when, 12), text: cut(h.event, 80) })) });
  if (r.recentResearch.length)
    raw.push({
      kicker: "최근 연구",
      heading: "요즘은 이런 연구가",
      lines: r.recentResearch.slice(0, 3).map((p) => ({ label: KIND_LABEL[p.kind], text: `${cut(p.title, 60)} — ${cut(p.contribution, 70)}` })),
    });
  if (r.canDo.length || r.hardYet.length)
    raw.push({
      kicker: "한계",
      heading: "할 수 있는 것과 어려운 것",
      lines: [...r.canDo.slice(0, 2).map((t) => ({ label: "가능", text: cut(t, 80) })), ...r.hardYet.slice(0, 2).map((t) => ({ label: "어려움", text: cut(t, 80) }))],
    });
  const srcLines = r.sources.slice(0, 4).map((s) => ({ label: host(s.url) || s.id, text: cut(s.title, 80) }));
  raw.push({
    kicker: "출처",
    heading: "자료를 찾은 곳",
    lines: srcLines.length ? srcLines : [{ text: "응답이 확인된 출처가 없습니다. 보고서의 출처 표를 확인하세요." }],
  });
  const scenes = raw.map((s, i) => ({ ...s, id: `s${i + 1}`, durationSec: sceneDuration(s.lines.length) }));
  const totalSec = scenes.reduce((sum, s) => sum + s.durationSec, 0);
  return { scenes, totalSec, sample: opts.sample };
}

/** HyperFrames 루트 구성. 장면은 `.clip` 구간, 애니메이션은 일시정지한 GSAP 타임라인 하나 */
export function buildComposition(plan: VideoPlan): string {
  let t = 0;
  const starts = plan.scenes.map((s) => {
    const at = t;
    t += s.durationSec;
    return at;
  });
  const sections = plan.scenes
    .map((s, i) => {
      const lines = s.lines
        .map(
          (l, j) =>
            `<li class="line" id="${s.id}-l${j + 1}">${l.label ? `<span class="tag">${escapeHtml(l.label)}</span>` : ""}<span class="txt">${escapeHtml(l.text)}</span></li>`,
        )
        .join("");
      return `<section class="clip scene" id="${s.id}" data-start="${starts[i]}" data-duration="${s.durationSec}" data-track-index="0">
  <p class="kicker" id="${s.id}-k">${escapeHtml(s.kicker)}</p>
  <h2 class="heading" id="${s.id}-h">${escapeHtml(s.heading)}</h2>
  <ul class="lines">${lines}</ul>
</section>`;
    })
    .join("\n");
  const tweens = plan.scenes
    .map((s, i) => {
      const at = starts[i];
      const per = s.lines.map((_, j) => `tl.from("#${s.id}-l${j + 1}", { opacity: 0, x: -40, duration: 0.5, ease: "power2.out" }, ${(at + 0.9 + j * 0.6).toFixed(2)});`).join("\n    ");
      return `tl.from("#${s.id}-k", { opacity: 0, y: -20, duration: 0.4, ease: "power2.out" }, ${(at + 0.1).toFixed(2)});
    tl.from("#${s.id}-h", { opacity: 0, y: 30, duration: 0.5, ease: "power2.out" }, ${(at + 0.3).toFixed(2)});
    ${per}`;
    })
    .join("\n    ");
  const badge = plan.sample ? "샘플 자료" : "kiro-cli 조사 · 출처 응답은 보고서에서 확인";
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${VIDEO_WIDTH}, height=${VIDEO_HEIGHT}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      :root { --ground: #0b1030; --ink: #fffbe6; --morning: #ffd23f; --pink: #ff7ab8; --font: "Noto Sans KR", sans-serif; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${VIDEO_WIDTH}px; height: ${VIDEO_HEIGHT}px; overflow: hidden; background: var(--ground); }
      #stage { position: relative; width: ${VIDEO_WIDTH}px; height: ${VIDEO_HEIGHT}px; font-family: var(--font); color: var(--ink); }
      .scene { position: absolute; left: 160px; top: 140px; width: 1600px; height: 740px; }
      .kicker { display: inline-block; padding: 8px 22px; background: var(--morning); color: #0b1030; border: 4px solid #000; font-size: 34px; font-weight: 800; box-shadow: 8px 8px 0 #000; }
      .heading { margin-top: 36px; font-size: 92px; line-height: 1.15; font-weight: 800; letter-spacing: -0.02em; word-break: keep-all; }
      .lines { margin-top: 44px; list-style: none; display: flex; flex-direction: column; gap: 22px; }
      .line { display: flex; align-items: baseline; gap: 24px; font-size: 44px; line-height: 1.35; word-break: keep-all; }
      .tag { flex: none; min-width: 120px; padding: 2px 16px; text-align: center; background: var(--pink); color: #000; border: 3px solid #000; font-size: 30px; font-weight: 800; }
      #foot { position: absolute; left: 160px; bottom: 56px; font-size: 28px; color: #aab3e6; }
      #brand { position: absolute; right: 160px; bottom: 56px; font-size: 28px; font-weight: 800; color: var(--morning); }
    </style>
  </head>
  <body>
    <div id="stage" data-composition-id="jamjarichae" data-start="0" data-duration="${plan.totalSec}" data-width="${VIDEO_WIDTH}" data-height="${VIDEO_HEIGHT}" data-fps="${VIDEO_FPS}">
${sections}
      <p id="foot">${escapeHtml(badge)}</p>
      <p id="brand">잠자리채</p>
    </div>
    <script>
    const tl = gsap.timeline({ paused: true });
    ${tweens}
    window.__timelines = window.__timelines || {};
    window.__timelines["jamjarichae"] = tl;
    </script>
  </body>
</html>
`;
}
