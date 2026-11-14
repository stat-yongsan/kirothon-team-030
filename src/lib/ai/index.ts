import type { Analysis, DomainAdapter } from "@/domain/types";
import { createClient, generateLiveDraft, type LiveClient } from "./anthropic";
import { getAiConfig, type AiMode } from "./config";
import { AiError } from "./errors";
import { generateMockDraft } from "./mock";
import { buildPrompt } from "./prompt";
import type { Draft } from "./schema";

export interface DraftResult {
  draft: Draft;
  mode: AiMode;
  /** live일 때 실제 응답한 모델 ID, mock이면 null */
  model: string | null;
}

/**
 * AI_MODE에 따라 샘플 또는 실제 Claude 초안을 만든다.
 * live 실패는 AiError로 그대로 올린다 — mock 결과로 대체하지 않는다.
 */
export async function generateDraft(
  adapter: DomainAdapter,
  analysis: Analysis,
  deps: { env?: Record<string, string | undefined>; client?: LiveClient } = {},
): Promise<DraftResult> {
  const config = getAiConfig(deps.env);
  if (config.mode === "mock") {
    return { draft: generateMockDraft(adapter, analysis), mode: "mock", model: null };
  }
  if (!deps.client && !config.apiKey) {
    throw new AiError("config", "AI_MODE=live이지만 ANTHROPIC_API_KEY가 설정되지 않았습니다.");
  }
  const client = deps.client ?? createClient(config.apiKey as string);
  const { system, user } = buildPrompt(adapter, analysis);
  const { draft, servedModel } = await generateLiveDraft({
    client,
    model: config.model,
    system,
    user,
    evidence: analysis.evidence,
  });
  return { draft, mode: "live", model: servedModel };
}

export type { Draft } from "./schema";
