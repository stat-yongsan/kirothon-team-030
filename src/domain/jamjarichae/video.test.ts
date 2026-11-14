import { describe, expect, it } from "vitest";
import { SAMPLE_CONCEPT } from "./fixtures";
import { buildComposition, cut, escapeHtml, planVideo, sceneDuration } from "./video";

describe("W2 영상 계획", () => {
  it("장면 길이는 줄 수에서 계산: 1줄 5초, 2줄 7초, 4줄 9초(상한)", () => {
    expect(sceneDuration(1)).toBe(5.5);
    expect(sceneDuration(2)).toBe(7);
    expect(sceneDuration(4)).toBe(9);
    expect(sceneDuration(10)).toBe(9);
    expect(sceneDuration(0)).toBe(5);
  });

  it("cut은 길이를 넘으면 말줄임표 포함 max자로 자름", () => {
    expect(cut("가나다라마", 5)).toBe("가나다라마");
    expect(cut("가나다라마바", 5)).toBe("가나다라…");
    expect(cut("  a   b ", 10)).toBe("a b");
  });

  it("샘플 연구로 장면을 만들고 합계 길이는 장면 길이의 합", () => {
    const plan = planVideo(SAMPLE_CONCEPT, { sample: true });
    expect(plan.scenes[0].kicker).toContain("샘플");
    expect(plan.scenes.at(-1)?.heading).toBe("자료를 찾은 곳");
    expect(plan.totalSec).toBe(plan.scenes.reduce((s, x) => s + x.durationSec, 0));
    expect(plan.scenes.every((s) => s.lines.length >= 1 && s.lines.length <= 4)).toBe(true);
  });

  it("구성 HTML은 장면마다 시작 시각이 앞 장면 길이의 누적이고, 모델 문장은 이스케이프된다", () => {
    const evil = { ...SAMPLE_CONCEPT, term: '<script>alert(1)</script>', oneLine: '"a" & <b>' };
    const plan = planVideo(evil, { sample: false });
    const html = buildComposition(plan);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain('data-start="0" data-duration="5.5"');
    expect(html).toContain('data-start="5.5"');
    expect(html).toContain(`data-duration="${plan.totalSec}"`);
    expect(html).toContain("kiro-cli 조사");
    expect(escapeHtml(`<'&">`)).toBe("&lt;&#39;&amp;&quot;&gt;");
  });
});
