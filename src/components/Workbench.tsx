"use client";

import { useMemo, useRef, useState } from "react";
import { currentDomain as domain } from "@/domain/current";
import type { Analysis } from "@/domain/types";
import type { Draft } from "@/lib/ai/schema";
import { buildMarkdown } from "@/lib/report/markdown";
import { AnalysisPanel } from "./AnalysisPanel";
import { DraftPanel, type AiState } from "./DraftPanel";
import { Badge, Button, Card, type Tone } from "./ui";

const MAX_FILE_BYTES = 100_000;

type Source = { kind: "none" } | { kind: "sample"; label: string } | { kind: "file"; name: string } | { kind: "paste" };

type Phase = "idle" | "sample" | "input_error" | "ready" | "drafting" | "result" | "api_error" | "reviewed";

const PHASES: Record<Phase, { label: string; tone: Tone; help: string }> = {
  idle: { label: "초기", tone: "neutral", help: "샘플을 고르거나 CSV 파일을 선택·붙여 넣으세요." },
  sample: { label: "샘플 선택", tone: "info", help: "샘플을 불러와 검증했습니다. AI 초안을 만들 수 있습니다." },
  input_error: { label: "입력 오류", tone: "danger", help: "표시된 행을 고치면 즉시 다시 검증합니다." },
  ready: { label: "검증 통과", tone: "info", help: "입력 검증을 통과했습니다. AI 초안을 만들 수 있습니다." },
  drafting: { label: "분석 중", tone: "info", help: "Claude가 검증된 근거로 초안을 작성하고 있습니다." },
  result: { label: "결과 · 미검토", tone: "warning", help: "초안과 근거를 검토하고 확인란을 체크하세요." },
  api_error: { label: "API 오류", tone: "danger", help: "AI 호출에 실패했습니다. 샘플 응답으로 대체하지 않았습니다." },
  reviewed: { label: "검토 완료", tone: "success", help: "Markdown 보고서를 내려받을 수 있습니다." },
};

function derivePhase(text: string, source: Source, analysis: Analysis | null, ai: AiState): Phase {
  if (ai.status === "loading") return "drafting";
  if (ai.status === "error") return "api_error";
  if (ai.status === "done") return ai.reviewed ? "reviewed" : "result";
  if (!text.trim() || !analysis) return "idle";
  if (analysis.issues.some((i) => i.severity === "error")) return "input_error";
  return source.kind === "sample" ? "sample" : "ready";
}

export function Workbench() {
  const [text, setText] = useState("");
  const [source, setSource] = useState<Source>({ kind: "none" });
  const [fileError, setFileError] = useState<string | null>(null);
  const [ai, setAi] = useState<AiState>({ status: "idle" });
  const [accessCode, setAccessCode] = useState(""); // 배포 live 모드 보호용. 저장하지 않고 이 탭에서만 유지
  const requestSeq = useRef(0);

  const analysis = useMemo(() => (text.trim() ? domain.analyze(text) : null), [text]);
  const phase = derivePhase(text, source, analysis, ai);
  const markdown =
    ai.status === "done" && analysis
      ? buildMarkdown(domain, analysis, ai.draft, {
          mode: ai.mode,
          model: ai.model,
          reviewed: ai.reviewed,
          generatedAt: ai.generatedAt,
        })
      : null;

  function setInput(next: string, nextSource: Source) {
    requestSeq.current += 1; // 진행 중이던 요청 결과는 버린다
    setText(next);
    setSource(nextSource);
    setFileError(null);
    setAi({ status: "idle" });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setFileError(`파일이 너무 큽니다 (${Math.round(file.size / 1000)}KB, 최대 100KB).`);
      return;
    }
    setInput(await file.text(), { kind: "file", name: file.name });
  }

  async function generate() {
    const seq = ++requestSeq.current;
    setAi({ status: "loading" });
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "content-type": "application/json", ...(accessCode ? { "x-access-code": accessCode } : {}) },
        body: JSON.stringify({ input: text }),
        signal: AbortSignal.timeout(150_000),
      });
      const data = await res.json().catch(() => null);
      if (seq !== requestSeq.current) return;
      if (!res.ok || !data?.draft) {
        setAi({
          status: "error",
          code: data?.error?.code ?? `http_${res.status}`,
          message: data?.error?.message ?? `서버 응답 오류 (${res.status})`,
        });
        return;
      }
      setAi({
        status: "done",
        draft: data.draft as Draft,
        mode: data.mode,
        model: data.model,
        reviewed: false,
        generatedAt: new Date().toLocaleString("ko-KR"),
      });
    } catch {
      if (seq !== requestSeq.current) return;
      setAi({ status: "error", code: "network", message: "서버에 연결하지 못했거나 응답 시간이 초과되었습니다." });
    }
  }

  function download() {
    if (!markdown) return;
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = domain.report.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const info = PHASES[phase];

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
        role="status"
        aria-live="polite"
      >
        <span className="text-sm font-semibold text-slate-700">현재 상태</span>
        <Badge tone={info.tone} testId="phase">
          {info.label}
        </Badge>
        <span className="min-w-0 text-sm text-slate-600">{info.help}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card step="1" title={domain.input.label} testId="input-panel">
          <p className="mb-3 text-xs text-slate-600">{domain.input.help}</p>
          <div className="mb-3 flex flex-wrap gap-2" aria-label="샘플 선택">
            {domain.samples.map((s) => (
              <Button
                key={s.id}
                variant="secondary"
                title={s.description}
                data-testid={`sample-${s.id}`}
                aria-pressed={source.kind === "sample" && source.label === s.label}
                onClick={() => setInput(s.content, { kind: "sample", label: s.label })}
              >
                {s.label}
              </Button>
            ))}
          </div>
          <label className="mb-3 block text-sm">
            <span className="font-semibold text-slate-800">CSV 파일 불러오기</span>
            <input
              type="file"
              accept={domain.input.accept}
              className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
              data-testid="file-input"
            />
          </label>
          {fileError && (
            <p role="alert" className="mb-2 text-sm text-rose-700">
              {fileError}
            </p>
          )}
          <label className="block text-sm">
            <span className="font-semibold text-slate-800">붙여넣기·직접 수정</span>
            <textarea
              className="mt-1 h-64 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs leading-5"
              placeholder={domain.input.placeholder}
              value={text}
              spellCheck={false}
              onChange={(e) => setInput(e.target.value, { kind: "paste" })}
              data-testid="input-text"
            />
          </label>
          <p className="mt-1 text-xs text-slate-500">
            {source.kind === "sample" && `불러온 샘플: ${source.label}`}
            {source.kind === "file" && `불러온 파일: ${source.name}`}
            {source.kind === "paste" && "직접 입력"}
          </p>
        </Card>

        <div className="min-w-0 space-y-4">
          <AnalysisPanel analysis={analysis} />
          <DraftPanel
            ai={ai}
            analysis={analysis}
            markdown={markdown}
            accessCode={accessCode}
            onAccessCode={setAccessCode}
            onGenerate={generate}
            onEdit={(draft) => ai.status === "done" && setAi({ ...ai, draft, reviewed: false })}
            onReviewed={(reviewed) => ai.status === "done" && setAi({ ...ai, reviewed })}
            onDownload={download}
          />
        </div>
      </div>
    </div>
  );
}
