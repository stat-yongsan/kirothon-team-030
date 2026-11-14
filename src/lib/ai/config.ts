import { AiError } from "./errors";

export type AiMode = "mock" | "live";

/** ANTHROPIC_MODEL이 비어 있을 때 사용할 기본 모델 */
export const DEFAULT_MODEL = "claude-opus-5-5";

export interface AiConfig {
  mode: AiMode;
  model: string;
  apiKey: string | null;
}

/** 서버 전용. 클라이언트 번들에서 호출하지 않는다(NEXT_PUBLIC_ 변수 사용 금지). */
export function getAiConfig(env: Record<string, string | undefined> = process.env): AiConfig {
  const rawMode = (env.AI_MODE ?? "mock").trim().toLowerCase() || "mock";
  if (rawMode !== "mock" && rawMode !== "live") {
    throw new AiError("config", `AI_MODE는 mock 또는 live여야 합니다 (현재: ${rawMode})`);
  }
  return {
    mode: rawMode,
    model: env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL,
    apiKey: env.ANTHROPIC_API_KEY?.trim() || null,
  };
}
