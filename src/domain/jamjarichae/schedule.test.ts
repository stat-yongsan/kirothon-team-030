import { describe, expect, it } from "vitest";
import { decideSchedule, verifyYearStated, zonedToUtc, type ScheduleCandidate } from "./schedule";

const NOW = new Date("2026-11-14T03:00:00Z"); // 2026-11-14 12:00 KST
const TZ = "Asia/Seoul";

const ev = (over: Partial<ScheduleCandidate> = {}): ScheduleCandidate => ({
  kind: "event",
  title: "AI 실무 세미나",
  date: "2026-11-20",
  yearStated: true,
  startTime: "15:00",
  endTime: "17:00",
  timezone: null,
  location: "본관 3층",
  excerpt: "일시: 2026년 11월 20일 15:00–17:00",
  ...over,
});

describe("zonedToUtc", () => {
  it("2026-11-20 15:00 KST = 06:00Z (손 검산: KST = UTC+9)", () => {
    expect(zonedToUtc("2026-11-20", "15:00", TZ)?.toISOString()).toBe("2026-11-20T06:00:00.000Z");
  });
  it("잘못된 시간대 → null", () => {
    expect(zonedToUtc("2026-11-20", "15:00", "Mars/Base")).toBeNull();
  });
});

describe("decideSchedule (R3.9, R3.10)", () => {
  it("행사 + 신청 마감 혼재: 행사만 등록 대상, 마감은 메모 (AC-12)", () => {
    const d = decideSchedule(
      { candidates: [ev(), { ...ev(), kind: "deadline", title: "사전 신청 마감", date: "2026-11-18", startTime: "18:00", endTime: null }], notes: [] },
      TZ,
      NOW,
    );
    expect(d.status).toBe("ready");
    expect(d.event?.date).toBe("2026-11-20");
    expect(d.event?.startUtc).toBe("2026-11-20T06:00:00.000Z");
    expect(d.event?.endUtc).toBe("2026-11-20T08:00:00.000Z");
    expect(d.notes.join(" ")).toContain("사전 신청 마감");
    expect(d.assumptions).toEqual(["원문에 시간대가 없어 사용자 시간대(Asia/Seoul)로 계산했습니다."]);
  });

  it("알림: 전날 같은 시각 = 11-19 06:00Z, 당일 시작 = 11-20 06:00Z", () => {
    const d = decideSchedule({ candidates: [ev()], notes: [] }, TZ, NOW);
    expect(d.reminders.map((r) => [r.minutes, r.atUtc, r.alreadyPassed])).toEqual([
      [1440, "2026-11-19T06:00:00.000Z", false],
      [0, "2026-11-20T06:00:00.000Z", false],
    ]);
  });

  it("전날 알림이 이미 지났으면 표시", () => {
    const d = decideSchedule({ candidates: [ev()], notes: [] }, TZ, new Date("2026-11-19T12:00:00Z"));
    expect(d.reminders[0].alreadyPassed).toBe(true);
    expect(d.reminders[1].alreadyPassed).toBe(false);
    expect(d.notes).toContain("이미 지난 알림 시각은 소급해서 전달되지 않습니다.");
  });

  it("연도 미기재 → 질문, 등록하지 않음", () => {
    const d = decideSchedule({ candidates: [ev({ yearStated: false })], notes: [] }, TZ, NOW);
    expect(d.status).toBe("needs_input");
    expect(d.event).toBeNull();
    expect(d.question).toContain("연도");
  });

  it("시작 시각 없음 → 질문", () => {
    expect(decideSchedule({ candidates: [ev({ startTime: null })], notes: [] }, TZ, NOW).question).toContain("시작 시각");
  });

  it("서로 다른 행사 후보 2개 → 질문", () => {
    const d = decideSchedule({ candidates: [ev(), ev({ date: "2026-11-27" })], notes: [] }, TZ, NOW);
    expect(d.status).toBe("needs_input");
    expect(d.question).toContain("2개");
  });

  it("같은 후보가 두 번 나오면 하나로 본다", () => {
    expect(decideSchedule({ candidates: [ev(), ev()], notes: [] }, TZ, NOW).status).toBe("ready");
  });

  it("행사 후보 없음(마감만) → 질문", () => {
    const d = decideSchedule({ candidates: [{ ...ev(), kind: "deadline" }], notes: [] }, TZ, NOW);
    expect(d.status).toBe("needs_input");
  });

  it("이미 지난 일정 → 질문", () => {
    expect(decideSchedule({ candidates: [ev({ date: "2026-11-01" })], notes: [] }, TZ, NOW).question).toContain("이미 지난");
  });

  it("종료 시각 없음 → 1시간 가정", () => {
    const d = decideSchedule({ candidates: [ev({ endTime: null })], notes: [] }, TZ, NOW);
    expect(d.event?.endTime).toBe("16:00");
    expect(d.assumptions).toContain("원문에 종료 시각이 없어 1시간 일정으로 잡았습니다.");
  });

  it("종료 ≤ 시작 → 질문", () => {
    expect(decideSchedule({ candidates: [ev({ endTime: "14:00" })], notes: [] }, TZ, NOW).status).toBe("needs_input");
  });

  it("원문 시간대가 있으면 그 시간대로 계산 (UTC 15:00 = 15:00Z)", () => {
    const d = decideSchedule({ candidates: [ev({ timezone: "UTC" })], notes: [] }, TZ, NOW);
    expect(d.event?.startUtc).toBe("2026-11-20T15:00:00.000Z");
    expect(d.assumptions).toEqual([]);
  });
});

describe("verifyYearStated: 모델의 연도 표시를 원문으로 다시 확인", () => {
  it("모델이 yearStated=true라고 해도 원문·답변에 2026이 없으면 연도 미기재 → 질문", () => {
    const x = verifyYearStated({ candidates: [ev({ yearStated: true })], notes: [] }, ["독서모임 11월 20일 15시", null]);
    expect(x.candidates[0].yearStated).toBe(false);
    expect(x.notes.join(" ")).toContain("연도(2026)가 없어");
    expect(decideSchedule(x, TZ, NOW).status).toBe("needs_input");
  });
  it("원문에 연도가 있으면 그대로 둔다", () => {
    const x = verifyYearStated({ candidates: [ev({ yearStated: true })], notes: [] }, ["2026년 11월 20일 15:00 세미나"]);
    expect(x.candidates[0].yearStated).toBe(true);
    expect(x.notes).toEqual([]);
  });
  it("사용자 답변에 연도가 있으면 그대로 둔다", () => {
    const x = verifyYearStated({ candidates: [ev({ yearStated: true })], notes: [] }, ["11월 20일 15시", "2026년이에요"]);
    expect(x.candidates[0].yearStated).toBe(true);
  });
});
