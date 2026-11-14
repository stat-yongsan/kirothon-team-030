// Google Calendar 일정 생성. REST만 쓴다. 토큰은 환경변수에서만 읽고 어디에도 남기지 않는다.
import { createHash } from "node:crypto";
import type { PlannedEvent, ScheduleDecision } from "../../domain/jamjarichae/schedule.ts";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface CalendarConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarId: string;
}

export class CalendarError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.retryable = status === 0 || status === 429 || status >= 500;
  }
}

export function readCalendarConfig(env: Record<string, string | undefined>): CalendarConfig | null {
  const clientId = env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  const refreshToken = env.GOOGLE_CALENDAR_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken, calendarId: env.GOOGLE_CALENDAR_ID?.trim() || "primary" };
}

/** 작업 ID에서 고정 이벤트 ID를 만든다. 재시도해도 같은 ID라 중복 일정이 생기지 않는다(Google은 소문자 a-v·0-9만 허용) */
export function eventIdFor(jobId: string): string {
  return `jjr${createHash("sha1").update(jobId).digest("hex").slice(0, 28)}`;
}

async function accessToken(cfg: CalendarConfig, f: FetchLike): Promise<string> {
  let res: Response;
  try {
    res = await f("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        refresh_token: cfg.refreshToken,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new CalendarError("Google 토큰 서버에 연결하지 못했습니다.", 0);
  }
  if (!res.ok) {
    let code = "";
    try {
      code = String(((await res.json()) as { error?: string }).error ?? "");
    } catch {
      /* 본문 없음 */
    }
    // invalid_grant = 동의 취소·만료. 다시 인증해야 한다
    throw new CalendarError(`Google 인증 실패 ${res.status}${code ? ` ${code}` : ""}`, res.status === 400 || res.status === 401 ? 401 : res.status);
  }
  const token = ((await res.json()) as { access_token?: string }).access_token;
  if (!token) throw new CalendarError("Google 토큰 응답에 access_token이 없습니다.", 502);
  return token;
}

export interface CreatedEvent {
  eventId: string;
  htmlLink: string;
  reminders: number[];
  /** 같은 작업으로 이미 만들어진 일정을 다시 찾은 경우 */
  existing: boolean;
}

export function buildEventBody(jobId: string, e: PlannedEvent, reminders: ScheduleDecision["reminders"]) {
  const active = reminders.filter((r) => !r.alreadyPassed);
  return {
    id: eventIdFor(jobId),
    summary: e.title,
    location: e.location ?? undefined,
    description: `잠자리채에서 등록한 일정입니다. 원문: ${e.excerpt}`.slice(0, 1000),
    start: { dateTime: e.startUtc, timeZone: e.timeZone },
    end: { dateTime: e.endUtc, timeZone: e.timeZone },
    reminders: { useDefault: false, overrides: active.map((r) => ({ method: "popup", minutes: r.minutes })) },
  };
}

export async function createCalendarEvent(
  cfg: CalendarConfig,
  jobId: string,
  e: PlannedEvent,
  reminders: ScheduleDecision["reminders"],
  f: FetchLike = fetch,
): Promise<CreatedEvent> {
  const token = await accessToken(cfg, f);
  const body = buildEventBody(jobId, e, reminders);
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cfg.calendarId)}/events`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  let res: Response;
  try {
    res = await f(base, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new CalendarError("Google Calendar에 연결하지 못했습니다.", 0);
  }
  let existing = false;
  if (res.status === 409) {
    // 앞선 시도가 서버에서는 성공했던 경우: 같은 ID의 일정을 조회해 그대로 쓴다
    existing = true;
    res = await f(`${base}/${body.id}`, { headers, signal: AbortSignal.timeout(20_000) });
  }
  if (!res.ok) throw new CalendarError(`Google Calendar 응답 ${res.status}`, res.status);
  const json = (await res.json()) as { id?: string; htmlLink?: string; status?: string };
  if (!json.id || !json.htmlLink) throw new CalendarError("Google Calendar 응답에 일정 URL이 없습니다.", 502);
  if (json.status === "cancelled") throw new CalendarError("같은 작업의 일정이 취소된 상태입니다. Calendar에서 삭제를 확정한 뒤 다시 시도하세요.", 409);
  return { eventId: json.id, htmlLink: json.htmlLink, reminders: body.reminders.overrides.map((o) => o.minutes), existing };
}
