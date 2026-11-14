import { z } from "zod";
import type { Evidence } from "@/domain/types";
import { AiError } from "./errors";

// 공통 AI 출력 구조. 주제가 바뀌어 구조가 달라지면 이 파일, 서버 검증, UI 렌더링을 함께 고친다.
export const DraftSchema = z.object({
  summary: z.string().trim().min(1).max(1500),
  sections: z
    .array(
      z.object({
        heading: z.string().trim().min(1).max(100),
        body: z.string().trim().min(1).max(3000),
        evidenceIds: z.array(z.string().trim().min(1)).min(1).max(30),
      }),
    )
    .min(1)
    .max(8),
  cautions: z.array(z.string().trim().min(1).max(500)).max(8),
});

export type Draft = z.infer<typeof DraftSchema>;

/** Claude 구조화 출력(output_config.format)용 JSON Schema. 길이 제한은 서버의 zod 검증이 맡는다. */
export const DRAFT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "sections", "cautions"],
  properties: {
    summary: { type: "string", description: "보고서 전체 요약 2~3문장" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heading", "body", "evidenceIds"],
        properties: {
          heading: { type: "string" },
          body: { type: "string" },
          evidenceIds: {
            type: "array",
            items: { type: "string" },
            description: "이 섹션에서 사용한 facts의 id",
          },
        },
      },
    },
    cautions: {
      type: "array",
      items: { type: "string" },
      description: "facts만으로 확정할 수 없어 사람이 확인해야 할 사항",
    },
  },
} as const;

/** 스키마 검증 + 모든 근거 ID가 입력 근거에 실제로 있는지 확인 */
export function validateDraft(value: unknown, evidence: Evidence[]): Draft {
  const parsed = DraftSchema.safeParse(value);
  if (!parsed.success) {
    const where = parsed.error.issues
      .slice(0, 3)
      .map((i) => i.path.join(".") || "(root)")
      .join(", ");
    throw new AiError("invalid_output", `AI 응답 형식이 올바르지 않습니다 (${where})`);
  }
  const known = new Set(evidence.map((e) => e.id));
  const unknown = new Set<string>();
  const draft: Draft = {
    ...parsed.data,
    sections: parsed.data.sections.map((s) => {
      for (const id of s.evidenceIds) if (!known.has(id)) unknown.add(id);
      return { ...s, evidenceIds: [...new Set(s.evidenceIds)] };
    }),
  };
  if (unknown.size > 0) {
    throw new AiError(
      "invalid_output",
      `AI 응답이 입력에 없는 근거 ID를 사용했습니다: ${[...unknown].slice(0, 5).join(", ")}`,
    );
  }
  return draft;
}
