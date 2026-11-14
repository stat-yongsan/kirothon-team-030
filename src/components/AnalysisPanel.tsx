import type { Analysis } from "@/domain/types";
import { Badge, Card } from "./ui";

export function AnalysisPanel({ analysis }: { analysis: Analysis | null }) {
  if (!analysis) {
    return (
      <Card step="2" title="검증·집계" testId="analysis-panel">
        <p className="text-sm text-slate-600">입력하면 코드가 즉시 검증하고 집계합니다. AI는 이 단계에 관여하지 않습니다.</p>
      </Card>
    );
  }

  const errors = analysis.issues.filter((i) => i.severity === "error");
  const warnings = analysis.issues.filter((i) => i.severity === "warning");

  return (
    <Card
      step="2"
      title="검증·집계"
      testId="analysis-panel"
      aside={
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={errors.length > 0 ? "danger" : "success"} testId="error-count">
            오류 {errors.length}건
          </Badge>
          <Badge tone={warnings.length > 0 ? "warning" : "neutral"}>주의 {warnings.length}건</Badge>
        </div>
      }
    >
      {analysis.issues.length > 0 && (
        <ul className="mb-4 space-y-1.5" aria-label="검증 결과" data-testid="issue-list">
          {[...errors, ...warnings].map((issue, i) => (
            <li
              key={i}
              className={`rounded-lg border px-3 py-2 text-sm break-words ${
                issue.severity === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-900"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              <span className="font-semibold">{issue.severity === "error" ? "오류" : "주의"}</span>
              {issue.line !== undefined && <span className="font-semibold"> · {issue.line}행</span>}
              {issue.field && <span> · {issue.field}</span>}
              <span> — {issue.message}</span>
            </li>
          ))}
        </ul>
      )}

      {analysis.metrics.length > 0 && (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5" data-testid="metrics">
            {analysis.metrics.map((m) => (
              <div key={m.id} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3" data-metric={m.id}>
                <dt className="text-xs text-slate-600">{m.label}</dt>
                <dd className="mt-1 text-lg font-bold break-words text-slate-900">{m.value}</dd>
                {m.note && <dd className="mt-0.5 text-[11px] leading-tight text-slate-500">{m.note}</dd>}
              </div>
            ))}
          </dl>
          {analysis.metricsNote && (
            <p className="mt-2 text-xs font-medium text-amber-800">{analysis.metricsNote}</p>
          )}
        </>
      )}

      {analysis.table && analysis.table.rows.length > 0 && (
        <div className="mt-4 max-w-full overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">
              {analysis.table.caption}
            </caption>
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                {analysis.table.columns.map((c) => (
                  <th key={c.key} scope="col" className={`px-3 py-2 font-semibold ${c.align === "right" ? "text-right" : "text-left"}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analysis.table.rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  {analysis.table!.columns.map((c) => (
                    <td key={c.key} className={`px-3 py-2 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                      {r.cells[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
