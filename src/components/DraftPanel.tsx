import type { Analysis } from "@/domain/types";
import type { Draft } from "@/lib/ai/schema";
import { Badge, Button, Card } from "./ui";

export type AiState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; code: string; message: string }
  | {
      status: "done";
      draft: Draft;
      mode: "mock" | "live";
      model: string | null;
      reviewed: boolean;
      generatedAt: string;
    };

interface Props {
  ai: AiState;
  analysis: Analysis | null;
  markdown: string | null;
  accessCode: string;
  onAccessCode: (code: string) => void;
  onGenerate: () => void;
  onEdit: (draft: Draft) => void;
  onReviewed: (reviewed: boolean) => void;
  onDownload: () => void;
}

export function DraftPanel({ ai, analysis, markdown, accessCode, onAccessCode, onGenerate, onEdit, onReviewed, onDownload }: Props) {
  const canDraft = analysis?.canDraft ?? false;
  const evidence = new Map((analysis?.evidence ?? []).map((e) => [e.id, e]));

  const aside =
    ai.status === "done" ? (
      <div className="flex flex-wrap gap-1.5">
        <Badge tone={ai.mode === "live" ? "info" : "warning"} testId="ai-mode">
          {ai.mode === "live" ? `실제 AI 응답 · ${ai.model ?? ""}` : "샘플 응답 (mock)"}
        </Badge>
        <Badge tone={ai.reviewed ? "success" : "neutral"} testId="review-status">
          {ai.reviewed ? "검토 완료" : "미검토"}
        </Badge>
      </div>
    ) : null;

  return (
    <Card step="3" title="AI 보고서 초안 · 검토 · 내보내기" testId="draft-panel" aside={aside}>
      {ai.status !== "done" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            코드가 검증한 수치와 근거 ID만 Claude에 보내 초안을 요청합니다. 초안의 모든 섹션은 근거에 연결됩니다.
          </p>
          {ai.status === "error" && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900" data-testid="api-error">
              <p className="font-semibold">AI 호출 실패 ({ai.code})</p>
              <p>{ai.message}</p>
              <p className="mt-1 text-xs">샘플 응답으로 대체하지 않았습니다. 원인을 확인한 뒤 다시 시도하세요.</p>
            </div>
          )}
          {ai.status === "error" && ai.code === "access_denied" && (
            <label className="block text-sm">
              <span className="font-semibold text-slate-800">접근 코드</span>
              <input
                type="password"
                autoComplete="off"
                className="mt-1 block w-full max-w-xs rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                value={accessCode}
                onChange={(e) => onAccessCode(e.target.value)}
                data-testid="access-code"
              />
            </label>
          )}
          <Button onClick={onGenerate} disabled={!canDraft || ai.status === "loading"} data-testid="generate">
            {ai.status === "loading" ? "초안 작성 중…" : ai.status === "error" ? "다시 시도" : "AI 보고서 초안 생성"}
          </Button>
          {!canDraft && analysis && (
            <p className="text-xs text-slate-500">입력 오류를 모두 고치면 초안을 만들 수 있습니다.</p>
          )}
        </div>
      )}

      {ai.status === "done" && (
        <div className="space-y-4">
          {ai.mode === "mock" && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              샘플 응답입니다. 실제 Claude가 작성하지 않았습니다 (AI_MODE=mock).
            </p>
          )}
          <label className="block">
            <span className="text-sm font-semibold text-slate-800">요약</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
              rows={3}
              value={ai.draft.summary}
              onChange={(e) => onEdit({ ...ai.draft, summary: e.target.value })}
            />
          </label>

          {ai.draft.sections.map((s, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3" data-testid="draft-section">
              <input
                aria-label={`섹션 ${i + 1} 제목`}
                className="w-full rounded border border-transparent px-1 text-sm font-semibold text-slate-900 hover:border-slate-200"
                value={s.heading}
                onChange={(e) => {
                  const sections = ai.draft.sections.map((x, j) => (j === i ? { ...x, heading: e.target.value } : x));
                  onEdit({ ...ai.draft, sections });
                }}
              />
              <textarea
                aria-label={`섹션 ${i + 1} 본문`}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                rows={Math.min(10, Math.max(3, s.body.split("\n").length + 1))}
                value={s.body}
                onChange={(e) => {
                  const sections = ai.draft.sections.map((x, j) => (j === i ? { ...x, body: e.target.value } : x));
                  onEdit({ ...ai.draft, sections });
                }}
              />
              <ul className="mt-2 space-y-1" aria-label="연결된 근거">
                {s.evidenceIds.map((id) => {
                  const e = evidence.get(id);
                  return (
                    <li key={id} className="text-xs break-words text-slate-600">
                      <code className="rounded bg-indigo-50 px-1.5 py-0.5 font-semibold text-indigo-800">{id}</code>{" "}
                      {e ? `${e.label}: ${e.value} (${e.source})` : "근거 없음"}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {ai.draft.cautions.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">확인 필요 사항</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                {ai.draft.cautions.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-start gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={ai.reviewed}
                onChange={(e) => onReviewed(e.target.checked)}
                data-testid="review-check"
              />
              수치와 근거를 확인했고 내용을 검토했습니다
            </label>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={onGenerate}>
                다시 생성
              </Button>
              <Button onClick={onDownload} disabled={!ai.reviewed} data-testid="download">
                Markdown 다운로드
              </Button>
            </div>
          </div>
          {!ai.reviewed && <p className="text-xs text-slate-500">검토 확인 후 내려받을 수 있습니다. 내용을 고치면 다시 확인해야 합니다.</p>}

          {markdown && (
            <details className="rounded-lg border border-slate-200">
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700">Markdown 미리보기</summary>
              <pre className="max-h-80 overflow-auto px-3 pb-3 text-xs break-words whitespace-pre-wrap text-slate-700" data-testid="markdown-preview">
                {markdown}
              </pre>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}
