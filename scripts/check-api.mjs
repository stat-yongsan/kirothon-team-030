#!/usr/bin/env node
// Anthropic API 실제 연결 확인. 키 값은 출력하지 않는다.
//   node scripts/check-api.mjs          AI_MODE=mock이면 실제 호출 없이 "mock 검증"만 보고
//   node scripts/check-api.mjs --live   AI_MODE와 무관하게 모델 조회 + 짧은 생성 1회(소량 과금)
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(ROOT, ".env.local");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile); // 이미 있는 환경변수는 덮어쓰지 않음

const forceLive = process.argv.includes("--live");
const mode = (process.env.AI_MODE ?? "mock").trim().toLowerCase() || "mock";
const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5-5";
const hasKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());

if (mode !== "live" && !forceLive) {
  console.log(`MOCK  AI_MODE=${mode} — 실제 API를 호출하지 않았습니다 (mock 검증).`);
  console.log(`      키 ${hasKey ? "설정됨" : "없음"}. 실제 확인: node scripts/check-api.mjs --live`);
  process.exit(0);
}
if (!hasKey) {
  console.log("FAIL  ANTHROPIC_API_KEY가 없습니다. .env.local에 설정하세요(값을 채팅·git에 남기지 말 것).");
  process.exit(1);
}

const client = new Anthropic({ timeout: 60_000, maxRetries: 1 });

function reason(error) {
  if (error instanceof Anthropic.AuthenticationError) return "인증 실패 — 키가 잘못되었거나 폐기됨";
  if (error instanceof Anthropic.PermissionDeniedError) return "권한 없음 — 이 키/조직에서 모델 사용 불가";
  if (error instanceof Anthropic.NotFoundError) return `모델 없음 — ANTHROPIC_MODEL(${model}) 확인`;
  if (error instanceof Anthropic.RateLimitError) return "호출 한도 초과 — 잠시 후 재시도";
  if (error instanceof Anthropic.BadRequestError) return `요청 거부(400): ${error.message.slice(0, 160)}`;
  if (error instanceof Anthropic.APIConnectionTimeoutError) return "시간 초과";
  if (error instanceof Anthropic.APIConnectionError) return "네트워크 연결 실패";
  if (error instanceof Anthropic.APIError) return `API 오류 ${error.status ?? ""}`;
  return String(error?.message ?? error);
}

try {
  const info = await client.models.retrieve(model);
  console.log(`PASS  모델 접근: ${info.id} (${info.display_name})`);
} catch (error) {
  console.log(`FAIL  모델 조회: ${reason(error)}`);
  process.exit(1);
}

try {
  const res = await client.messages.create({
    model,
    max_tokens: 1024,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: "연결 확인입니다. OK 한 단어로만 답하세요." }],
  });
  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  const ok = res.stop_reason === "end_turn" && text.length > 0;
  console.log(
    `${ok ? "PASS" : "FAIL"}  짧은 생성: stop_reason=${res.stop_reason}, 응답="${text.slice(0, 40)}", tokens in/out=${res.usage.input_tokens}/${res.usage.output_tokens}, served=${res.model}`,
  );
  process.exit(ok ? 0 : 1);
} catch (error) {
  console.log(`FAIL  짧은 생성: ${reason(error)}`);
  process.exit(1);
}
