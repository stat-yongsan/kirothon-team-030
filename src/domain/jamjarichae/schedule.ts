// W6 일정잡기의 코드 판정. AI는 원문에서 후보를 뽑기만 하고, 등록 가능 여부·알림 시각은 여기서 정한다.
import { z } from "zod";

export const ScheduleCandidateSchema = z.object({
  kind: z.enum(["event", "deadline", "other"]),
  title: z.string().min(1).max(200),
  /** YYYY-MM-DD. 원문에 연도가 없으면 yearStated=false로 두고 추정 연도를 넣지 않아도 된다 */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  yearStated: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  timezone: z.string().max(64).nullable(),
  location: z.string().max(300).nullable(),
  excerpt: z.string().max(500),
});
export type ScheduleCandidate = z.infer<typeof ScheduleCandidateSchema>;

export const ScheduleExtractionSchema = z.object({
  candidates: z.array(ScheduleCandidateSchema).max(10),
  notes: z.array(z.string().max(300)).max(10).default([]),
});
export type ScheduleExtraction = z.infer<typeof ScheduleExtractionSchema>;

/** 전날 = 시작 24시간 전, 당일 = 시작 시각. 화면 문구는 "전날 같은 시각 / 당일 시작 시각" */
export const DEFAULT_REMINDERS = [
  { minutes: 1440, label: "전날 같은 시각" },
  { minutes: 0, label: "당일 시작 시각" },
] as const;

export interface PlannedEvent {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  location: string | null;
  startUtc: string;
  endUtc: string;
  excerpt: string;
}

export interface ScheduleDecision {
  status: "ready" | "needs_input";
  event: PlannedEvent | null;
  question: string | null;
  reminders: { minutes: number; label: string; atUtc: string | null; alreadyPassed: boolean }[];
  assumptions: string[];
  notes: string[];
}

/** 시간대 tz에서 utcMs 시점의 UTC 대비 오프셋(ms) */
function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return asUtc - utcMs;
}

/** 현지 날짜·시각(tz)을 UTC 시점으로 바꾼다. 잘못된 시간대면 null */
export function zonedToUtc(date: string, time: string, tz: string): Date | null {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    return null;
  }
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const first = guess - tzOffsetMs(guess, tz);
  const second = guess - tzOffsetMs(first, tz);
  const out = new Date(second);
  return Number.isNaN(out.getTime()) ? null : out;
}

function addMinutes(time: string, minutes: number): string | null {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  if (total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const key = (c: ScheduleCandidate) => `${c.date}|${c.startTime}|${c.endTime}`;

/**
 * 후보를 판정한다. 규칙 순서:
 * 1) 행사 후보 0개 → 질문  2) 서로 다른 행사 후보 2개 이상 → 질문
 * 3) 날짜 없음 / 연도 미기재 / 시작 시각 없음 → 질문  4) 종료 ≤ 시작 → 질문  5) 이미 지난 일정 → 질문
 * 시간대 미기재는 사용자 시간대로, 종료 시각 미기재는 1시간으로 가정하고 가정을 표시한다.
 * 신청 마감(deadline)은 행사일과 구분해 메모로만 남기고 등록하지 않는다(AC-12).
 */
/**
 * 모델이 표시한 yearStated를 원문으로 다시 확인한다(코드 판정).
 * 연도 판정을 모델의 yearStated 표시에만 맡기지 않는다. 연도 숫자(예: 2026)가 원문·사용자 답변 어디에도 없으면 연도 미기재로 본다.
 */
export function verifyYearStated(extraction: ScheduleExtraction, sourceTexts: (string | null | undefined)[]): ScheduleExtraction {
  const source = sourceTexts.filter(Boolean).join("\n");
  const notes = [...extraction.notes];
  const candidates = extraction.candidates.map((c) => {
    if (!c.yearStated || !c.date) return c;
    const year = c.date.slice(0, 4);
    if (source.includes(year)) return c;
    notes.push(`"${c.title}": 원문과 답변에 연도(${year})가 없어 코드가 연도 미기재로 판정했습니다.`);
    return { ...c, yearStated: false };
  });
  return { ...extraction, candidates, notes: notes.slice(0, 10) };
}

export function decideSchedule(extraction: ScheduleExtraction, userTz: string, now: Date): ScheduleDecision {
  const assumptions: string[] = [];
  const notes: string[] = [...extraction.notes];
  const ask = (question: string): ScheduleDecision => ({
    status: "needs_input",
    event: null,
    question,
    reminders: [],
    assumptions,
    notes,
  });

  for (const d of extraction.candidates.filter((c) => c.kind === "deadline")) {
    notes.push(`신청·접수 마감 "${d.title}"(${d.date ?? "날짜 미상"} ${d.startTime ?? ""})은 행사 일정과 별도라 등록하지 않았습니다.`);
  }

  const events = extraction.candidates.filter((c) => c.kind === "event");
  if (events.length === 0) return ask("원문에서 행사 일시를 찾지 못했습니다. 등록할 날짜와 시작 시각을 알려 주세요.");

  const distinct = [...new Map(events.map((e) => [key(e), e])).values()];
  if (distinct.length > 1) {
    const list = distinct.map((e, i) => `${i + 1}) ${e.title} ${e.date ?? "날짜 미상"} ${e.startTime ?? "시각 미상"}`).join(" / ");
    return ask(`일정 후보가 ${distinct.length}개입니다: ${list}. 어느 일정을 등록할까요?`);
  }

  const ev = distinct[0];
  if (!ev.date) return ask(`"${ev.title}"의 날짜가 원문에 없습니다. 날짜를 알려 주세요.`);
  if (!ev.yearStated) {
    return ask(`"${ev.title}" ${ev.date.slice(5)}의 연도가 원문에 없습니다. 몇 년 일정인지 알려 주세요.`);
  }
  if (!ev.startTime) return ask(`"${ev.title}"(${ev.date})의 시작 시각이 원문에 없습니다. 시작 시각을 알려 주세요.`);

  let tz = ev.timezone?.trim() || "";
  if (!tz) {
    tz = userTz;
    assumptions.push(`원문에 시간대가 없어 사용자 시간대(${userTz})로 계산했습니다.`);
  }
  let end = ev.endTime;
  if (!end) {
    end = addMinutes(ev.startTime, 60);
    if (!end) return ask(`"${ev.title}"이 자정 무렵 시작합니다. 종료 시각을 알려 주세요.`);
    assumptions.push("원문에 종료 시각이 없어 1시간 일정으로 잡았습니다.");
  }
  if (end <= ev.startTime) {
    return ask(`"${ev.title}"의 종료 시각(${end})이 시작 시각(${ev.startTime})보다 빠릅니다. 자정을 넘기는 일정인지 확인해 주세요.`);
  }

  const start = zonedToUtc(ev.date, ev.startTime, tz);
  const finish = zonedToUtc(ev.date, end, tz);
  if (!start || !finish) return ask(`시간대 "${tz}" 또는 날짜를 해석하지 못했습니다. 다시 알려 주세요.`);
  if (start.getTime() <= now.getTime()) {
    return ask(`"${ev.title}"(${ev.date} ${ev.startTime})은 이미 지난 시각입니다. 날짜를 다시 확인해 주세요.`);
  }

  const reminders = DEFAULT_REMINDERS.map((r) => {
    const at = new Date(start.getTime() - r.minutes * 60_000);
    const alreadyPassed = at.getTime() <= now.getTime();
    return { minutes: r.minutes, label: r.label, atUtc: at.toISOString(), alreadyPassed };
  });
  if (reminders.some((r) => r.alreadyPassed)) {
    notes.push("이미 지난 알림 시각은 소급해서 전달되지 않습니다.");
  }

  return {
    status: "ready",
    event: {
      title: ev.title,
      date: ev.date,
      startTime: ev.startTime,
      endTime: end,
      timeZone: tz,
      location: ev.location,
      startUtc: start.toISOString(),
      endUtc: finish.toISOString(),
      excerpt: ev.excerpt,
    },
    question: null,
    reminders,
    assumptions,
    notes,
  };
}
