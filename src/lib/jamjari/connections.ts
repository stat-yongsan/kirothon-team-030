// 외부 연결 상태. 값은 환경변수·워커 점검 결과로만 판정하고, 연결되지 않은 것을 연결됐다고 표시하지 않는다.
import fs from "node:fs";
import path from "node:path";
import { accessToken, readCalendarConfig } from "./calendar.ts";
import { readNotionConfig } from "./notion.ts";
import { readBeat } from "./store.ts";

export type ConnState = "connected" | "not_configured" | "unsupported" | "unknown" | "down";

export interface Connection {
  id: "kiro" | "worker" | "calendar" | "notion" | "video";
  label: string;
  state: ConnState;
  detail: string;
}

export const WORKER_STALE_MS = 20_000;

export function hyperframesInstalled(): boolean {
  return fs.existsSync(path.join(process.cwd(), "node_modules", "hyperframes", "bin", "hyperframes.mjs"));
}

export function notionConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.NOTION_TOKEN?.trim() && env.NOTION_ROOT_PAGE_ID?.trim());
}

export type Probes = Partial<Record<"calendar" | "notion", { ok: boolean; detail: string; checkedAt: string }>>;

const PROBE_TTL_MS = 60_000;
let probeCache: { at: number; value: Probes } | null = null;

async function probeCalendar(env: Record<string, string | undefined>): Promise<Probes["calendar"]> {
  const cfg = readCalendarConfig(env);
  if (!cfg) return undefined;
  const checkedAt = new Date().toISOString();
  try {
    const token = await accessToken(cfg, fetch);
    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok
      ? { ok: true, detail: "권한 확인됨(calendar.events). 일정이 확정되면 전날·당일 알림과 함께 등록합니다. 생성된 일정 URL은 작업 결과에서 확인하세요.", checkedAt }
      : { ok: false, detail: `캘린더 접근 실패(HTTP ${res.status}). node scripts/google-auth.mjs로 다시 동의하세요.`, checkedAt };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? `Google 인증 실패: ${e.message}` : "Google에 연결하지 못했습니다.", checkedAt };
  }
}

async function probeNotion(env: Record<string, string | undefined>): Promise<Probes["notion"]> {
  const cfg = readNotionConfig(env);
  if (!cfg) return undefined;
  const checkedAt = new Date().toISOString();
  try {
    const res = await fetch(`https://api.notion.com/v1/pages/${cfg.rootPageId}`, {
      headers: { Authorization: `Bearer ${cfg.token}`, "Notion-Version": "2022-06-28" },
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok
      ? { ok: true, detail: "토큰과 루트 페이지 접근 확인됨 — 루트 › 날짜 › 경로 › 작업 순으로 기록합니다.", checkedAt }
      : { ok: false, detail: `루트 페이지 접근 실패(HTTP ${res.status}). 연동 앱에 페이지를 공유했는지 확인하세요.`, checkedAt };
  } catch {
    return { ok: false, detail: "Notion에 연결하지 못했습니다.", checkedAt };
  }
}

/** 실제 호출로 Calendar·Notion 연결을 확인한다. 60초 동안 결과를 재사용한다(3초마다 화면이 부르므로) */
export async function probeConnections(env: Record<string, string | undefined> = process.env): Promise<Probes> {
  if (env.VERCEL) return {};
  if (probeCache && Date.now() - probeCache.at < PROBE_TTL_MS) return probeCache.value;
  const [calendar, notion] = await Promise.all([probeCalendar(env), probeNotion(env)]);
  const value: Probes = { ...(calendar ? { calendar } : {}), ...(notion ? { notion } : {}) };
  probeCache = { at: Date.now(), value };
  return value;
}

export function listConnections(env: Record<string, string | undefined> = process.env, now = new Date(), probes: Probes = {}): Connection[] {
  const beat = readBeat();
  const alive = beat ? now.getTime() - new Date(beat.beatAt).getTime() < WORKER_STALE_MS : false;
  return [
    {
      id: "worker",
      label: "야간 워커",
      state: alive ? "connected" : "down",
      detail: alive
        ? `실행 중(pid ${beat?.pid}, 마지막 신호 ${beat?.beatAt.slice(11, 19)} UTC)`
        : "꺼져 있음 — 터미널에서 npm.cmd run worker 실행. 꺼져 있으면 맡긴 작업은 대기 상태로 남습니다.",
    },
    {
      id: "kiro",
      label: "생성 엔진 kiro-cli",
      state: beat?.kiro ? (beat.kiro.ok ? "connected" : "down") : "unknown",
      detail: beat?.kiro ? `${beat.kiro.detail} (워커가 ${beat.kiro.checkedAt.slice(11, 19)} UTC 확인)` : "워커가 아직 확인하지 않음",
    },
    {
      id: "calendar",
      label: "Google Calendar",
      state: !readCalendarConfig(env) ? "not_configured" : probes.calendar ? (probes.calendar.ok ? "connected" : "down") : "unknown",
      detail: !readCalendarConfig(env)
        ? "Google 동의(refresh token) 없음 — node scripts/google-auth.mjs 실행 전까지 일정은 코드 판정까지만 하고 등록하지 않습니다(일정 URL 없음)."
        : probes.calendar?.detail ?? "권한을 확인하는 중…",
    },
    {
      id: "notion",
      label: "Notion 날짜별 기록",
      state: !notionConfigured(env) ? "not_configured" : probes.notion ? (probes.notion.ok ? "connected" : "down") : "unknown",
      detail: !notionConfigured(env)
        ? "NOTION_TOKEN·NOTION_ROOT_PAGE_ID 없음 — 결과는 앱에 먼저 보관합니다."
        : probes.notion?.detail ?? "토큰과 루트 페이지를 확인하는 중…",
    },
    {
      id: "video",
      label: "영상 렌더 HyperFrames",
      // 서버리스(공개 시연판)에는 워커가 없어 렌더하지 않는다. 패키지가 번들에 있어도 연결됨으로 표시하지 않는다
      state: env.VERCEL ? "unsupported" : hyperframesInstalled() ? "connected" : "not_configured",
      detail: env.VERCEL
        ? "공개 시연판에는 워커가 없어 영상을 만들지 않습니다. 보이는 영상은 개발자 PC에서 렌더한 결과입니다."
        : hyperframesInstalled()
        ? "로컬에서 MP4를 만듭니다(계정·API 키 불필요, 내레이션·음악 없음). 첫 렌더는 폰트·GSAP를 내려받느라 인터넷이 필요합니다."
        : "hyperframes 패키지가 없습니다 — npm install 후 사용할 수 있습니다.",
    },  ];
}
