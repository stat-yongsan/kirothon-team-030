#!/usr/bin/env node
// kiro-cli용 로컬 Google Calendar MCP(stdio, 읽기 전용). 의존성 없음.
// 왜 필요한가: Google 공식 Calendar MCP는 토큰 교환에 client secret이 필요한데, kiro-cli 3.3의 MCP oauth 설정은
// clientId만 읽어 로그인이 끝나지 않는다(400 invalid_request). 그래서 scripts/google-auth.mjs가 .env.local에 저장한
// refresh token으로 Calendar REST API를 직접 조회한다. 토큰·비밀값은 stdout·stderr 어디에도 출력하지 않는다.
import fs from "node:fs";
import readline from "node:readline";

const ENV_PATH = new URL("../.env.local", import.meta.url);
const TZ = "Asia/Seoul";
const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

function loadEnv() {
  const out = {};
  try {
    for (const l of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^"|"$/g, "");
    }
  } catch {
    /* .env.local 없음: 아래에서 미설정으로 안내 */
  }
  const pick = (k) => (process.env[k] ?? out[k] ?? "").trim();
  return {
    clientId: pick("GOOGLE_CALENDAR_CLIENT_ID"),
    clientSecret: pick("GOOGLE_CALENDAR_CLIENT_SECRET"),
    refreshToken: pick("GOOGLE_CALENDAR_REFRESH_TOKEN"),
    calendarId: pick("GOOGLE_CALENDAR_ID") || "primary",
  };
}

class ToolError extends Error {}

async function accessToken(cfg) {
  if (!cfg.clientId || !cfg.clientSecret || !cfg.refreshToken) {
    throw new ToolError(
      "Google Calendar 연결 정보가 없습니다(.env.local의 GOOGLE_CALENDAR_CLIENT_ID·CLIENT_SECRET·REFRESH_TOKEN). " +
        "작업 폴더에서 `node scripts/google-auth.mjs`를 실행해 동의를 받은 뒤 다시 요청하세요.",
    );
  }
  let res;
  try {
    res = await fetch("https://oauth2.googleapis.com/token", {
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
    throw new ToolError("Google 토큰 서버에 연결하지 못했습니다(네트워크).");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    const code = body.error ? ` ${body.error}` : "";
    const hint = body.error === "invalid_grant" ? " 동의가 만료·취소됐습니다. `node scripts/google-auth.mjs`로 다시 인증하세요." : "";
    throw new ToolError(`Google 인증 실패 ${res.status}${code}.${hint}`);
  }
  return body.access_token;
}

function parseTime(v, name) {
  if (v === undefined || v === null || v === "") return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new ToolError(`${name}을(를) 날짜로 읽지 못했습니다: ${String(v).slice(0, 40)}`);
  return d;
}

const fmt = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function when(e) {
  if (e.start?.date) {
    // 종일 일정: Google의 end.date는 다음 날(배타적)
    const end = e.end?.date ? new Date(Date.parse(e.end.date) - 86_400_000).toISOString().slice(0, 10) : e.start.date;
    return end === e.start.date ? `${e.start.date} 종일` : `${e.start.date} ~ ${end} 종일`;
  }
  const s = e.start?.dateTime ? fmt.format(new Date(e.start.dateTime)) : "?";
  const t = e.end?.dateTime ? fmt.format(new Date(e.end.dateTime)) : "?";
  return `${s} ~ ${t}`;
}

async function listEvents(args, cfg) {
  const now = new Date();
  const timeMin = parseTime(args.timeMin, "timeMin") ?? now;
  const timeMax = parseTime(args.timeMax, "timeMax") ?? new Date(timeMin.getTime() + 7 * 86_400_000);
  if (timeMax <= timeMin) throw new ToolError("timeMax는 timeMin보다 뒤여야 합니다.");
  const max = Math.min(Math.max(Number.parseInt(args.maxResults ?? 20, 10) || 20, 1), 50);

  const token = await accessToken(cfg);
  const qs = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(max),
    timeZone: TZ,
  });
  if (args.query) qs.set("q", String(args.query).slice(0, 200));
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cfg.calendarId)}/events?${qs}`;
  let res;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new ToolError("Google Calendar에 연결하지 못했습니다(네트워크).");
  }
  if (!res.ok) {
    const hint = res.status === 403 ? " 권한(스코프) 또는 Calendar API 사용 설정을 확인하세요." : "";
    throw new ToolError(`Google Calendar 응답 ${res.status}.${hint}`);
  }
  const json = await res.json();
  const events = (json.items ?? [])
    .filter((e) => e.status !== "cancelled")
    .map((e) => ({
      id: e.id,
      title: e.summary ?? "(제목 없음)",
      start: e.start?.dateTime ?? e.start?.date ?? null,
      end: e.end?.dateTime ?? e.end?.date ?? null,
      when: when(e),
      location: e.location ?? null,
      htmlLink: e.htmlLink ?? null,
      fromJamjari: typeof e.description === "string" && e.description.startsWith("잠자리채에서 등록한 일정"),
    }));

  const range = `${fmt.format(timeMin)} ~ ${fmt.format(timeMax)} (${TZ})`;
  const lines = [`캘린더 ${cfg.calendarId === "primary" ? "기본" : cfg.calendarId} · ${range} · ${events.length}건${json.nextPageToken ? " (더 있음)" : ""}`];
  for (const e of events) {
    lines.push(`- ${e.when} | ${e.title}${e.location ? ` @ ${e.location}` : ""}${e.fromJamjari ? " [잠자리채]" : ""}`);
    if (e.htmlLink) lines.push(`  ${e.htmlLink}`);
  }
  if (events.length === 0) lines.push("이 기간에 일정이 없습니다.");
  return {
    content: [{ type: "text", text: lines.join("\n") }],
    structuredContent: { calendarId: cfg.calendarId, timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), count: events.length, hasMore: Boolean(json.nextPageToken), events },
  };
}

const TOOLS = [
  {
    name: "list_events",
    title: "Google Calendar 일정 조회",
    description:
      "Google Calendar 기본 캘린더의 일정을 시간순으로 조회한다(읽기 전용). 기간을 주지 않으면 지금부터 7일. " +
      "시각은 ISO 8601(예: 2026-11-20T00:00:00+09:00). 잠자리채 W6가 만든 일정은 [잠자리채]로 표시된다.",
    inputSchema: {
      type: "object",
      properties: {
        timeMin: { type: "string", description: "조회 시작 시각(ISO 8601). 기본: 지금" },
        timeMax: { type: "string", description: "조회 끝 시각(ISO 8601). 기본: timeMin + 7일" },
        query: { type: "string", description: "제목·설명·장소에서 찾을 단어(선택)" },
        maxResults: { type: "integer", minimum: 1, maximum: 50, description: "최대 개수. 기본 20" },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
];

async function handle(msg) {
  const { method, params } = msg;
  switch (method) {
    case "initialize": {
      const asked = params?.protocolVersion;
      return {
        protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "jamjari-google-calendar", version: "1.0.0" },
        instructions: "Google Calendar 일정을 읽기 전용으로 조회한다. 일정 생성은 잠자리채 앱(W6)이 담당한다.",
      };
    }
    case "ping":
      return {};
    case "tools/list":
      return { tools: TOOLS };
    case "tools/call": {
      if (params?.name !== "list_events") throw Object.assign(new Error(`알 수 없는 도구: ${params?.name}`), { rpcCode: -32602 });
      try {
        return await listEvents(params.arguments ?? {}, loadEnv());
      } catch (e) {
        const text = e instanceof ToolError ? e.message : "일정 조회 중 예상하지 못한 오류가 났습니다.";
        if (!(e instanceof ToolError)) console.error(`[calendar-mcp] ${e?.name ?? "Error"}`);
        return { content: [{ type: "text", text }], isError: true };
      }
    }
    default:
      // server/discover 등 미지원 요청: kiro는 이 오류를 보고 표준 initialize 흐름으로 내려간다
      throw Object.assign(new Error(`Method not found: ${method}`), { rpcCode: -32601 });
  }
}

function send(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

const pending = new Set();
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    return;
  }
  const isRequest = msg && typeof msg.method === "string" && msg.id !== undefined && msg.id !== null;
  if (!isRequest) return; // 알림·응답은 처리할 것이 없다
  const p = handle(msg)
    .then((result) => send({ jsonrpc: "2.0", id: msg.id, result }))
    .catch((e) => send({ jsonrpc: "2.0", id: msg.id, error: { code: e.rpcCode ?? -32603, message: e.message } }))
    .finally(() => pending.delete(p));
  pending.add(p);
});
// 입력이 닫혀도 진행 중인 조회 응답은 보낸 뒤 끝낸다
rl.on("close", () => Promise.allSettled([...pending]).then(() => process.exit(0)));
