#!/usr/bin/env node
// Google Calendar 동의를 1회 받아 refresh token을 .env.local에 저장한다. 토큰 값은 화면에 출력하지 않는다.
// 사전 조건: Google Cloud OAuth 클라이언트의 승인된 리디렉션 URI에 http://localhost:7778/oauth/callback 등록.
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";

const ENV = ".env.local";
const REDIRECT = "http://localhost:7778/oauth/callback";
const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

function readEnv() {
  const out = {};
  for (const l of fs.readFileSync(ENV, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
  return out;
}

function writeEnvKey(key, value) {
  const lines = fs.readFileSync(ENV, "utf8").split(/\r?\n/);
  const i = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (i >= 0) lines[i] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  fs.writeFileSync(ENV, lines.join("\n").replace(/\n*$/, "\n"));
}

const env = readEnv();
if (!env.GOOGLE_CALENDAR_CLIENT_ID || !env.GOOGLE_CALENDAR_CLIENT_SECRET) {
  console.error("GOOGLE_CALENDAR_CLIENT_ID / GOOGLE_CALENDAR_CLIENT_SECRET이 .env.local에 없습니다.");
  process.exit(1);
}

const state = crypto.randomBytes(16).toString("hex");
const verifier = crypto.randomBytes(32).toString("base64url");
const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: env.GOOGLE_CALENDAR_CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", REDIRECT);
  if (url.pathname !== "/oauth/callback") {
    res.writeHead(404).end();
    return;
  }
  const done = (code, msg) => {
    res.writeHead(code, { "Content-Type": "text/plain; charset=utf-8" }).end(msg);
    server.close();
  };
  if (url.searchParams.get("state") !== state) return done(400, "state 불일치: 요청을 무시했습니다.");
  const err = url.searchParams.get("error");
  if (err) {
    console.error(`동의가 거부되었거나 실패했습니다: ${err}`);
    process.exitCode = 1;
    return done(400, `실패: ${err}`);
  }
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: url.searchParams.get("code") ?? "",
      client_id: env.GOOGLE_CALENDAR_CLIENT_ID,
      client_secret: env.GOOGLE_CALENDAR_CLIENT_SECRET,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body.refresh_token) {
    console.error(`토큰 교환 실패(${r.status}${body.error ? ` ${body.error}` : ""}). refresh_token ${body.refresh_token ? "있음" : "없음"}.`);
    process.exitCode = 1;
    return done(500, "토큰 교환 실패. 터미널을 확인하세요.");
  }
  writeEnvKey("GOOGLE_CALENDAR_REFRESH_TOKEN", body.refresh_token);
  console.log("완료: GOOGLE_CALENDAR_REFRESH_TOKEN을 .env.local에 저장했습니다(값은 출력하지 않음). 워커를 다시 시작하세요.");
  done(200, "완료. 이 창을 닫고 터미널로 돌아가세요.");
});

server.listen(7778, "127.0.0.1", () => {
  console.log("브라우저에서 Google 동의 화면을 승인하세요. 열리지 않으면 아래 주소를 직접 여세요.\n");
  console.log(authUrl.toString());
  spawn("cmd", ["/c", "start", "", authUrl.toString().replace(/&/g, "^&")], { stdio: "ignore", detached: true }).unref();
});
setTimeout(() => {
  console.error("5분 안에 동의가 없어 종료합니다.");
  process.exit(1);
}, 5 * 60_000).unref();
