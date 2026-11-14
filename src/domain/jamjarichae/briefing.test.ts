import { describe, expect, it } from "vitest";
import { buildBriefing } from "./briefing";
import type { JobStatus } from "./contracts";
import type { JobView } from "./job";

const job = (id: string, status: JobStatus, completedAt: string | null = null, withResult = true): JobView =>
  ({
    id,
    status,
    completedAt,
    question: status === "needs_input" ? { text: "연도는?", answer: null } : null,
    result: withResult ? ({ title: id, highlights: [], status: "completed" } as unknown as JobView["result"]) : null,
  }) as JobView;

describe("buildBriefing (R4.1, R4.2)", () => {
  it("실제 상태를 센다: 저장만 한 것·취소는 '맡긴 수'에서 제외", () => {
    const b = buildBriefing([
      job("a", "completed", "2026-11-15T00:01:00Z"),
      job("b", "completed", "2026-11-15T00:05:00Z"),
      job("c", "completed", "2026-11-15T00:03:00Z"),
      job("d", "partial", "2026-11-15T00:09:00Z"),
      job("e", "needs_input"),
      job("f", "draft"),
      job("g", "cancelled"),
    ]);
    expect(b.total).toBe(5);
    expect(b.sentence).toBe("맡긴 5개 중 완료 3, 부분 완료 1, 확인 필요 1");
    expect(b.counts.saved).toBe(1);
    // 완료 먼저(최근 완료 순) → 부분 완료, 최대 3개
    expect(b.top.map((j) => j.id)).toEqual(["b", "c", "a"]);
    expect(b.questions.map((j) => j.id)).toEqual(["e"]);
  });

  it("맡긴 것이 없으면 안내 문장", () => {
    expect(buildBriefing([job("f", "draft")]).sentence).toBe("아직 맡긴 생각이 없습니다.");
  });

  it("외부 조치·실패·진행 중도 구분", () => {
    const b = buildBriefing([job("a", "awaiting_external_action"), job("b", "failed"), job("c", "running"), job("d", "queued")]);
    expect(b.sentence).toBe("맡긴 4개 중 외부 조치 필요 1, 실패 1, 진행 중 2");
  });
});
