// 외부 연결 상태. 값은 환경변수·워커 점검 결과로만 판정하고, 연결되지 않은 것을 연결됐다고 표시하지 않는다.
import fs from "node:fs";
import path from "node:path";
import { readBeat } from "./store.ts";

export type ConnState = "connected" | "not_configured" | "unsupported" | "unknown" | "down";

export interface Connection {
  id: "kiro" | "worker" | "google_login" | "calendar" | "notion" | "video";
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

export function listConnections(env: Record<string, string | undefined> = process.env, now = new Date()): Connection[] {
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
      id: "google_login",
      label: "Google 로그인",
      state: env.GOOGLE_CLIENT_ID?.trim() ? "unknown" : "not_configured",
      detail: "OAuth 클라이언트 미구성 — 지금은 이 PC의 소유자 1명 모드로 동작합니다.",
    },
    {
      id: "calendar",
      label: "Google Calendar",
      state: "not_configured",
      detail: "Calendar MCP·OAuth 미연결 — 일정은 코드 판정까지 하고 등록하지 않습니다(일정 URL 없음).",
    },
    {
      id: "notion",
      label: "Notion 날짜별 기록",
      state: notionConfigured(env) ? "unknown" : "not_configured",
      detail: notionConfigured(env)
        ? "토큰 설정됨 — 실제 동기화는 작업별 결과에서 확인하세요(이번 버전 실연동 미검증)."
        : "NOTION_TOKEN·NOTION_ROOT_PAGE_ID 없음 — 결과는 앱에 먼저 보관합니다.",
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
    },
  ];
}
