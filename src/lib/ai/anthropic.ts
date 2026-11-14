import Anthropic from "@anthropic-ai/sdk";
import type { Evidence } from "@/domain/types";
import { AiError } from "./errors";
import { DRAFT_JSON_SCHEMA, validateDraft, type Draft } from "./schema";

const MAX_OUTPUT_TOKENS = 12_000;
const TIMEOUT_MS = 50_000;
/** 일시적 오류 재시도는 최대 1회 */
const MAX_RETRIES = 1;

/** 서버 측 거절 대체(fallbacks: "default")를 지원하는 모델 */
const FALLBACK_MODELS = new Set([
  "claude-fable-5-2",
  "claude-fable-5-1",
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-sonnet-5-5",
]);

export type LiveClient = Pick<Anthropic, "beta">;

export function createClient(apiKey: string): LiveClient {
  return new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: MAX_RETRIES });
}

export async function generateLiveDraft(args: {
  client: LiveClient;
  model: string;
  system: string;
  user: string;
  evidence: Evidence[];
}): Promise<{ draft: Draft; servedModel: string }> {
  const { client, model, system, user, evidence } = args;
  const fallback = FALLBACK_MODELS.has(model)
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};

  let response: Anthropic.Beta.Messages.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system,
      messages: [{ role: "user", content: user }],
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: DRAFT_JSON_SCHEMA },
      },
      ...fallback,
    });
  } catch (error) {
    throw toAiError(error);
  }

  if (response.stop_reason === "refusal") {
    throw new AiError("refusal", "AI가 이 요청에 대한 응답을 거절했습니다. 입력 내용을 확인하세요.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new AiError("truncated", "AI 응답이 출력 상한에서 잘렸습니다. 입력을 줄이거나 다시 시도하세요.");
  }

  const text = response.content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AiError("invalid_output", "AI 응답이 JSON 형식이 아닙니다.");
  }
  return { draft: validateDraft(json, evidence), servedModel: response.model };
}

function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AiError("auth", "Anthropic API 인증에 실패했습니다. ANTHROPIC_API_KEY를 확인하세요.");
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new AiError("config", "모델을 찾을 수 없습니다. ANTHROPIC_MODEL 값을 확인하세요.");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AiError("rate_limit", "API 호출 한도에 걸렸습니다. 잠시 후 다시 시도하세요.");
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new AiError("upstream", "API가 요청 형식을 거부했습니다. 모델과 파라미터 호환성을 확인하세요.");
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new AiError("timeout", "AI 응답 시간이 초과되었습니다. 다시 시도하세요.");
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AiError("upstream", "Anthropic API에 연결하지 못했습니다. 네트워크를 확인하세요.");
  }
  if (error instanceof Anthropic.APIError) {
    return new AiError("upstream", `Anthropic API 오류(${error.status ?? "unknown"})가 발생했습니다.`);
  }
  return new AiError("upstream", "AI 호출 중 알 수 없는 오류가 발생했습니다.");
}
