"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Briefing } from "@/domain/jamjarichae/briefing";
import {
  JOB_STATUS_LABEL,
  LIMITS,
  outputsFor,
  PURPOSE_LABEL,
  PURPOSES,
  STEP_LABEL,
  validateCapture,
  workflowSpec,
  type JobStatus,
  type OutputKind,
  type Purpose,
} from "@/domain/jamjarichae/contracts";
import { SAMPLE_CAPTURES } from "@/domain/jamjarichae/fixtures";
import type { JobView } from "@/domain/jamjarichae/job";
import type { Connection } from "@/lib/jamjari/connections";

interface ApiState {
  jobs: JobView[];
  briefing: Briefing;
  connections: Connection[];
}

const PURPOSE_STYLE: Record<Purpose, { tab: string; icon: string; hint: string }> = {
  concept: { tab: "bg-[#ffd23f]", icon: "📖", hint: "정의·원리·역사·최근 연구" },
  idea: { tab: "bg-[#7bd88f]", icon: "⚡", hint: "서로 다른 5개 / 체험 페이지" },
  summary: { tab: "bg-[#a78bfa]", icon: "🔗", hint: "링크 1개 요약" },
  schedule: { tab: "bg-[#ff6b9a]", icon: "📅", hint: "일정·알림 판정" },
};

const STATUS_STYLE: Partial<Record<JobStatus, string>> = {
  completed: "bg-[#7bd88f]",
  partial: "bg-[#ffd23f]",
  needs_input: "bg-[#ff6b9a]",
  awaiting_external_action: "bg-[#a78bfa]",
  awaiting_external_confirmation: "bg-[#a78bfa]",
  failed: "bg-[#ff8a5b]",
  running: "bg-[#8ecbff]",
  queued: "bg-white",
  scheduled: "bg-white",
  draft: "bg-[#f1ece0]",
  cancelled: "bg-[#e5e5e5]",
};

const frame = "rounded-2xl border-[3px] border-black shadow-[4px_4px_0_#000]";
const box = `${frame} bg-[#fffdf5]`;
const btn =
  "rounded-xl border-[3px] border-black px-4 py-2 font-bold shadow-[3px_3px_0_#000] transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#000] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]";

type Page = "home" | "capture" | "board" | "morning" | "all";
const HOME: { id: Exclude<Page, "home">; n: string; label: string; color: string; badge: (d: ApiState | null) => string }[] = [
  { id: "capture", n: "1", label: "목적이 뭐야?", color: "bg-[#ffd23f]", badge: () => "생각·링크·사진 담기" },
  {
    id: "board",
    n: "2",
    label: "밤 작업 보드",
    color: "bg-[#8ecbff]",
    badge: (d) => `대기·진행 중 ${(d?.jobs ?? []).filter((j) => ["draft", "queued", "scheduled", "running"].includes(j.status)).length}개`,
  },
  {
    id: "morning",
    n: "3",
    label: "아침에 꺼내보기",
    color: "bg-[#ff6b9a]",
    badge: (d) => `새 결과 ${(d?.jobs ?? []).filter((j) => j.result && !j.acknowledgedAt && ["completed", "partial", "failed", "awaiting_external_action", "awaiting_external_confirmation"].includes(j.status)).length}개`,
  },
  { id: "all", n: "4", label: "전체 결과함", color: "bg-[#7bd88f]", badge: (d) => `확인완료 ${(d?.jobs ?? []).filter((j) => j.acknowledgedAt).length}개` },
];

function api(path: string, init?: RequestInit) {
  return fetch(path, { ...init, headers: { "x-jamjari": "1", ...(init?.headers ?? {}) } });
}

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(16).slice(2)}`);

export function JamjariApp() {
  const [data, setData] = useState<ApiState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState<Page>("home");

  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [purpose, setPurpose] = useState<Purpose>("concept");
  const [output, setOutput] = useState<OutputKind>("html");
  const [sample, setSample] = useState(false);
  // 데모 기본값: 담자마자 큐에 넣어 워커가 바로 처리한다. 끄면 저장만 하고 '잠자리채에 맡기기'로 한꺼번에 맡긴다
  const [runNow, setRunNow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  // 중복 클릭 방지 키. 렌더 중 난수를 만들지 않도록 첫 제출 때 만든다(Next 프리렌더 규칙)
  const keyRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api("/api/jamjari/jobs", { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? `HTTP ${res.status}`);
      setData(await res.json());
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, 3000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [refresh]);

  const check = useMemo(
    () =>
      validateCapture({
        purpose,
        output,
        text,
        url,
        image: image ? { name: image.name, type: image.type, size: image.size } : undefined,
      }),
    [purpose, output, text, url, image],
  );
  const touched = Boolean(text.trim() || url.trim() || image);

  function choosePurpose(p: Purpose) {
    setPurpose(p);
    setOutput(outputsFor(p)[0].output);
    setServerErrors([]);
  }

  function fillSample(id: string) {
    const s = SAMPLE_CAPTURES.find((x) => x.id === id);
    if (!s) return;
    setText(s.text ?? "");
    setUrl(s.url ?? "");
    setImage(null);
    if (fileRef.current) fileRef.current.value = "";
    setPurpose(s.purpose);
    setOutput(s.output);
    setSample(true);
    setServerErrors([]);
    setNotice(`샘플 "${s.label}"을 채웠습니다. 샘플 모드는 Kiro 호출·외부 접속을 하지 않습니다.`);
  }

  async function submit() {
    setBusy(true);
    setServerErrors([]);
    setNotice(null);
    const form = new FormData();
    form.set("text", text);
    form.set("url", url);
    form.set("purpose", purpose);
    form.set("output", output);
    form.set("intent", runNow ? "queue" : "save");
    form.set("sample", String(sample));
    keyRef.current ??= newKey();
    form.set("idempotencyKey", keyRef.current);
    if (image) form.set("image", image);
    try {
      const res = await api("/api/jamjari/jobs", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) {
        setServerErrors(body?.error?.details?.length ? body.error.details : [body?.error?.message ?? `HTTP ${res.status}`]);
        return;
      }
      keyRef.current = null;
      setText("");
      setUrl("");
      setImage(null);
      if (fileRef.current) fileRef.current.value = "";
      setNotice(!body.created ? "이미 담은 생각입니다(중복 저장 안 함)." : runNow ? "담고 바로 정리를 시작했습니다. 아래 작업 보드에서 진행 상태가 바뀝니다(오늘 실측 작업당 10초–1분)." : "생각을 담았습니다. 자기 전에 '잠자리채에 맡기기'를 누르세요.");
      await refresh();
    } catch {
      setServerErrors(["서버에 연결하지 못했습니다."]);
    } finally {
      setBusy(false);
    }
  }

  async function entrust() {
    setBusy(true);
    try {
      const res = await api("/api/jamjari/run", { method: "POST", body: "{}" });
      const body = await res.json();
      setNotice(res.ok ? `${body.queued.length}개를 잠자리채에 맡겼습니다. 브라우저를 닫아도 워커가 이어갑니다.` : body?.error?.message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: "cancel" | "answer" | "ack", value?: string) {
    const res = await api(`/api/jamjari/jobs/${id}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(action === "answer" ? { answer: value ?? "" } : {}),
    });
    const body = await res.json().catch(() => null);
    setNotice(res.ok ? (action === "answer" ? "답변을 저장하고 다시 맡겼습니다." : action === "ack" ? "확인완료: 전체 결과함에 보관했습니다." : "취소했습니다.") : body?.error?.message ?? "요청 실패");
    await refresh();
  }

  const jobs = data?.jobs ?? [];
  const drafts = jobs.filter((j) => j.status === "draft");
  // 밤 작업 보드: 저장(대기)·큐·진행 중인 것만. 끝난 것은 아침에 꺼내보기로 간다
  const waiting = jobs.filter((j) => ["draft", "queued", "scheduled", "running"].includes(j.status));
  const worker = data?.connections.find((c) => c.id === "worker");
  const showErrors = touched && !check.ok ? check.errors : [];

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-5 sm:px-6 sm:py-8">
      {/* 머리 */}
      <header className={`${box} relative overflow-hidden px-5 py-6 sm:px-8`}>
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full border-[3px] border-black bg-[#ff6b9a]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-12 right-24 hidden h-24 w-24 sm:block rounded-full border-[3px] border-black bg-[#a78bfa]" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <p className="rounded-lg border-2 border-black bg-[#ffd23f] px-3 py-1 text-sm font-black">잠자리채</p>
          <p
            data-testid="worker-status"
            role="status"
            className={`rounded-lg border-2 border-black px-3 py-1 text-xs font-bold ${worker?.state === "connected" ? "bg-[#7bd88f]" : "bg-[#ff8a5b]"}`}
          >
            {worker ? (worker.state === "connected" ? "● 워커 실행 중" : "○ 워커 꺼짐") : "상태 확인 중"}
          </p>
        </div>
        <h1 className="relative mt-4 text-3xl font-black leading-tight break-keep sm:text-5xl">
          날아가는 생각,
          <br />
          잠자리에서 잡아드립니다
        </h1>
        <p className="relative mt-3 max-w-xl text-base font-medium text-neutral-700">
          생각·사진·링크를 남겨주세요. 잠든 동안 정리하고, 아침에 꺼내 쓰세요.
        </p>
      </header>

      {loadError && (
        <p role="alert" className={`${frame} mt-4 bg-[#ff8a5b] px-4 py-3 font-bold`}>
          작업 목록을 불러오지 못했습니다: {loadError}
        </p>
      )}

      {page === "home" ? (
        <nav aria-label="메뉴" className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="home">
          {HOME.map((c) => (
            <button
              key={c.id}
              type="button"
              data-testid={`page-${c.id}`}
              onClick={() => setPage(c.id)}
              className={`${frame} ${c.color} flex min-h-44 flex-col items-start justify-between p-5 text-left transition hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#000] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] sm:min-h-56`}
            >
              <span className="text-5xl font-black leading-none">{c.n}</span>
              <span>
                <span className="block text-xl font-black break-keep sm:text-2xl">{c.label}</span>
                <span className="mt-1 block text-sm font-bold">{c.badge(data)}</span>
              </span>
            </button>
          ))}
        </nav>
      ) : (
        <nav aria-label="돌아가기" className="mt-6">
          <button type="button" data-testid="page-home" onClick={() => setPage("home")} className={`${btn} bg-white text-sm`}>
            ← 처음으로
          </button>
        </nav>
      )}

      {/* 1. 목적 · 생각 담기 */}
      {page === "capture" && (
      <>
      <div data-testid="briefing-area">
        <p data-testid="briefing" role="status" className="inline-block rounded-xl border-[3px] border-black bg-[#ffd23f] px-3 py-1.5 font-black shadow-[3px_3px_0_#000]">
          {data ? data.briefing.sentence : "불러오는 중…"}
        </p>
        {data && data.briefing.questions.length > 0 && (
          <div className="mt-4 rounded-2xl border-[3px] border-black bg-[#ffe1ec] p-3" data-testid="questions">
            <h3 className="font-black">내 답변이 필요한 것 {data.briefing.questions.length}개</h3>
            {data.briefing.questions.map((q) => (
              <AnswerBox key={q.id} job={q} label="답변" onSubmit={(v) => act(q.id, "answer", v)} />
            ))}
          </div>
        )}
      </div>
      <section aria-labelledby="capture-h" className={`${box} mt-6 px-4 py-5 sm:px-6`}>
        <h2 id="capture-h" className="text-xl font-black">
          목적이 뭐야?
        </h2>

        <div className="mt-3 flex flex-wrap gap-2" aria-label="샘플로 채우기">
          {SAMPLE_CAPTURES.filter((s) => s.id !== "proto" && s.id !== "bad").map((s) => (
            <button key={s.id} type="button" data-testid={`sample-${s.id}`} onClick={() => fillSample(s.id)} className={`${btn} bg-white px-3 py-1 text-sm`}>
              {s.label}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-sm font-bold" htmlFor="memo">
          메모
        </label>
        <textarea
          id="memo"
          data-testid="memo"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={LIMITS.textChars + 100}
          placeholder="예) RAG가 뭐지? / 점심 메뉴 고르는 데 매일 10분씩 쓴다, 줄이는 서비스 / 11월 20일 15:00 AI 세미나"
          className="mt-1 w-full rounded-xl border-[3px] border-black bg-white px-3 py-2 text-base shadow-[3px_3px_0_#000] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2563eb]"
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <label className="block text-sm font-bold" htmlFor="url">
              링크
            </label>
            <div className="mt-1 flex items-center rounded-xl border-[3px] border-black bg-white px-3 shadow-[3px_3px_0_#000] focus-within:ring-4 focus-within:ring-[#2563eb]">
              <span aria-hidden className="text-lg font-black">
                #
              </span>
              <input
                id="url"
                data-testid="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https:// 링크 붙여넣기"
                inputMode="url"
                className="w-full min-w-0 bg-transparent px-2 py-2 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold" htmlFor="image">
              사진(선택)
            </label>
            <input
              id="image"
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full max-w-full rounded-xl border-[3px] border-black bg-white px-2 py-1.5 text-sm shadow-[3px_3px_0_#000] file:mr-2 file:rounded-lg file:border-2 file:border-black file:bg-[#ffd23f] file:px-2 file:font-bold"
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-neutral-600">사진은 저장·조합 확인만 합니다. 사진 내용 분석은 이번 버전에 연결되지 않았습니다.</p>

        <fieldset className="mt-5">
          <legend className="text-sm font-bold">무엇으로 만들어둘까요?</legend>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PURPOSES.map((p) => {
              const st = PURPOSE_STYLE[p];
              const on = purpose === p;
              return (
                <label key={p} className="relative cursor-pointer pt-3">
                  <span aria-hidden className={`absolute left-3 top-0 h-4 w-16 rounded-t-lg border-[3px] border-b-0 border-black ${st.tab}`} />
                  <input type="radio" name="purpose" value={p} checked={on} onChange={() => choosePurpose(p)} className="peer sr-only" data-testid={`purpose-${p}`} />
                  <span
                    className={`block rounded-2xl border-[3px] border-black px-3 py-3 shadow-[4px_4px_0_#000] peer-focus-visible:ring-4 peer-focus-visible:ring-[#2563eb] ${on ? st.tab : "bg-white"}`}
                  >
                    <span aria-hidden className="text-xl">
                      {st.icon}
                    </span>
                    <span className="mt-1 block font-black">{PURPOSE_LABEL[p]}</span>
                    <span className="block text-xs text-neutral-700">{st.hint}</span>
                    {on && <span className="mt-1 inline-block rounded border-2 border-black bg-white px-1 text-[11px] font-bold">선택됨</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-sm font-bold">결과 형태</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {outputsFor(purpose).map((w) => (
              <label key={w.id} className="cursor-pointer">
                <input type="radio" name="output" value={w.output} checked={output === w.output} onChange={() => setOutput(w.output)} className="peer sr-only" data-testid={`output-${w.output}`} />
                <span className="inline-block rounded-xl border-[3px] border-black bg-white px-3 py-1.5 text-sm font-bold shadow-[3px_3px_0_#000] peer-checked:bg-black peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-[#2563eb]">
                  {w.outputLabel}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" data-testid="capture" onClick={submit} disabled={busy || !check.ok} className={`${btn} bg-[#ffd23f] text-lg`}>
            {runNow ? "＋ 담고 바로 정리" : "＋ 생각 담기"}
          </button>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={runNow} onChange={(e) => setRunNow(e.target.checked)} data-testid="run-now" className="h-5 w-5 accent-black" />
            바로 정리(데모: 밤까지 기다리지 않음)
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={sample} onChange={(e) => setSample(e.target.checked)} data-testid="sample-mode" className="h-5 w-5 accent-black" />
            샘플 모드(Kiro 호출·외부 접속 없음)
          </label>
        </div>
        {(showErrors.length > 0 || serverErrors.length > 0) && (
          <ul role="alert" data-testid="capture-errors" className="mt-3 space-y-1 rounded-xl border-[3px] border-black bg-[#ff8a5b] px-4 py-2 text-sm font-bold">
            {[...showErrors, ...serverErrors].map((e) => (
              <li key={e}>⚠ {e}</li>
            ))}
          </ul>
        )}
        {notice && (
          <p role="status" data-testid="notice" className="mt-3 rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-bold">
            {notice}
          </p>
        )}
      </section>
      </>

      )}

      {/* 2. 밤 작업 보드 */}
      {page === "board" && (
      <section aria-labelledby="board-h" className={`${frame} mt-6 bg-[#1b2a4e] px-4 py-5 text-white sm:px-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="board-h" className="text-xl font-black">
            ② 밤 작업 보드
          </h2>
          <button type="button" data-testid="entrust" onClick={entrust} disabled={busy || drafts.length === 0} className={`${btn} bg-[#ffd23f] text-black`}>
            🌙 잠자리채에 맡기기 ({drafts.length})
          </button>
        </div>
        {worker && worker.state !== "connected" && (
          <p role="status" className="mt-3 rounded-xl border-2 border-white bg-[#ff8a5b] px-3 py-2 text-sm font-bold text-black">
            워커 꺼짐 — 맡긴 작업은 대기 상태로 남습니다. 터미널에서 <code>npm.cmd run worker</code>를 실행하세요.
          </p>
        )}
        <ul className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="board">
          {waiting.length === 0 && <li className="text-sm text-white/80">대기·진행 중인 작업이 없습니다.</li>}
          {waiting.slice(0, 12).map((j) => (
            <BoardCard key={j.id} job={j} onCancel={() => act(j.id, "cancel")} />
          ))}
        </ul>
      </section>

      )}

      {/* 3. 아침에 꺼내보기 · 전체 결과함 */}
      {(page === "morning" || page === "all") && <Morning data={data} view={page} onAck={(id) => act(id, "ack")} />}

      {page !== "home" && (
      <>
      {/* 4. 연결 상태 */}
      <section aria-labelledby="conn-h" className={`${box} mt-6 px-4 py-5 sm:px-6`}>
        <h2 id="conn-h" className="text-xl font-black">
          연결 상태
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="connections">
          {(data?.connections ?? []).map((c) => (
            <li key={c.id} className="rounded-xl border-2 border-black bg-white px-3 py-2 text-sm">
              <span className={`mr-2 inline-block rounded border-2 border-black px-1.5 text-xs font-black ${c.state === "connected" ? "bg-[#7bd88f]" : c.state === "unsupported" ? "bg-[#a78bfa]" : c.state === "down" ? "bg-[#ff8a5b]" : "bg-[#f1ece0]"}`}>
                {c.state === "connected" ? "연결됨" : c.state === "not_configured" ? "미연결" : c.state === "unsupported" ? "API 미지원" : c.state === "down" ? "꺼짐" : "확인 전"}
              </span>
              <strong>{c.label}</strong>
              <span className="mt-0.5 block text-neutral-700">{c.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      </>
      )}

      <footer className="mt-6 pb-6 text-xs font-medium text-neutral-800">
        잠자리채 MVP · 이 PC의 소유자 1명 로컬 모드 · 생성 엔진 kiro-cli headless · 판정(조합·날짜·개수·안전 검사)은 코드가 합니다.
      </footer>
    </div>
  );
}

function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span data-testid="job-status" className={`inline-block rounded-lg border-2 border-black px-2 py-0.5 text-xs font-black text-black ${STATUS_STYLE[status] ?? "bg-white"}`}>
      {JOB_STATUS_LABEL[status]}
    </span>
  );
}

function preview(j: JobView) {
  return j.input.text?.slice(0, 80) || j.input.url || (j.input.image ? `사진: ${j.input.image.name}` : "");
}

function BoardCard({ job, onCancel }: { job: JobView; onCancel: () => void }) {
  const spec = workflowSpec(job.workflow);
  const cancellable = ["draft", "queued", "scheduled", "running", "needs_input"].includes(job.status);
  return (
    <li className="rounded-2xl border-[3px] border-black bg-[#fffdf5] p-3 text-black shadow-[4px_4px_0_#000]">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={job.status} />
        <span className={`rounded-lg border-2 border-black px-2 py-0.5 text-xs font-bold ${PURPOSE_STYLE[spec.purpose].tab}`}>
          {PURPOSE_LABEL[spec.purpose]} · {spec.outputLabel}
        </span>
        {job.sample && <span className="rounded-lg border-2 border-black bg-[#fde68a] px-2 py-0.5 text-xs font-bold">샘플</span>}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium break-all">{preview(job)}</p>
      <p className="mt-1 text-xs text-neutral-600">
        입력 {job.captureDate}
        {job.status === "running" && job.stage ? ` · ${STEP_LABEL[job.stage]}` : ""}
        {job.attempts > 0 ? ` · 시도 ${job.attempts}` : ""}
        {job.status === "scheduled" && job.runAt ? ` · 재시도 ${new Date(job.runAt).toLocaleTimeString("ko-KR")}` : ""}
      </p>
      {cancellable && (
        <button type="button" onClick={onCancel} className="mt-2 rounded-lg border-2 border-black bg-white px-2 py-0.5 text-xs font-bold hover:bg-neutral-100">
          취소
        </button>
      )}
    </li>
  );
}

const FINISHED: JobStatus[] = ["completed", "partial", "failed", "awaiting_external_action", "awaiting_external_confirmation"];

function Morning({ data, view, onAck }: { data: ApiState | null; view: "morning" | "all"; onAck: (id: string) => void }) {
  const finished = (data?.jobs ?? []).filter((j) => j.result && FINISHED.includes(j.status));
  const results = finished.filter((j) => !j.acknowledgedAt);
  const archive = finished.filter((j) => j.acknowledgedAt).sort((a, b) => (b.acknowledgedAt ?? "").localeCompare(a.acknowledgedAt ?? ""));
  return (
    <section aria-labelledby="morning-h" className={`${box} mt-6 px-4 py-5 sm:px-6`}>
      <h2 id="morning-h" className="text-xl font-black">
        {view === "all" ? "전체 결과함" : "③ 아침에 꺼내보기"}
      </h2>
      {view === "morning" && (
      <>
      <h3 className="mt-5 font-black">완료된 결과 {results.length}개</h3>
      <div className="mt-2 grid gap-3" data-testid="results-new">
        {results.length === 0 && <p className="text-sm text-neutral-600">새로 확인할 결과가 없습니다.</p>}
        {results.map((j) => (
          <ResultCard key={j.id} job={j} onAck={() => onAck(j.id)} />
        ))}
      </div>
      </>
      )}

      {view === "all" && (
      <div className="mt-3 grid gap-3" data-testid="results">
        {archive.length === 0 && <p className="text-sm text-neutral-600">확인완료한 결과가 아직 없습니다. 아침에 꺼내보기에서 &ldquo;확인완료&rdquo;를 누르면 여기에 쌓입니다.</p>}
        {archive.map((j) => (
          <ResultCard key={j.id} job={j} />
        ))}
      </div>
      )}
    </section>
  );
}

function AnswerBox({ job, label, onSubmit, placeholder }: { job: JobView; label: string; onSubmit: (v: string) => void; placeholder?: string }) {
  const [v, setV] = useState("");
  const id = `answer-${job.id}`;
  return (
    <div className="mt-2">
      <label htmlFor={id} className="block text-sm font-bold">
        {job.question?.text ?? label}
      </label>
      <div className="mt-1 flex flex-wrap gap-2">
        <input id={id} value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className="min-w-0 flex-1 rounded-lg border-2 border-black bg-white px-2 py-1" />
        <button type="button" disabled={!v.trim()} onClick={() => onSubmit(v)} className="rounded-lg border-2 border-black bg-black px-3 py-1 text-sm font-bold text-white disabled:opacity-50">
          {label} 보내기
        </button>
      </div>
    </div>
  );
}

function ResultCard({ job, compact, onAnswer, onAck }: { job: JobView; compact?: boolean; onAnswer?: (id: string, v: string) => void; onAck?: () => void }) {
  const r = job.result!;
  const spec = workflowSpec(job.workflow);
  const isProto = r.artifactType === "web_prototype";
  const [reviewed, setReviewed] = useState(false);
  return (
    <article data-testid="result-card" className="rounded-2xl border-[3px] border-black bg-white p-3 shadow-[4px_4px_0_#000]">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={job.status} />
        <span className={`rounded-lg border-2 border-black px-2 py-0.5 text-xs font-bold ${PURPOSE_STYLE[spec.purpose].tab}`}>{spec.outputLabel}</span>
        <span className="rounded-lg border-2 border-black bg-[#f1ece0] px-2 py-0.5 text-xs font-bold">{r.engine === "sample" ? "샘플 결과" : r.engine === "kiro-cli" ? "kiro-cli 실제 생성" : "코드"}</span>
      </div>
      <h4 className="mt-2 font-black break-keep">{r.title}</h4>
      <ul className="mt-1 list-disc pl-5 text-sm">
        {r.highlights.slice(0, compact ? 2 : 3).map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
      {r.nextAction && (
        <p className="mt-2 rounded-lg border-2 border-black bg-[#fffbe6] px-2 py-1 text-sm">
          <strong>다음 행동</strong> {r.nextAction}
        </p>
      )}
      {r.videoUrl && !compact && (
        <div className="mt-2">
          <video src={r.videoUrl} controls preload="metadata" data-testid="result-video" className="w-full rounded-lg border-2 border-black bg-black" aria-label={`${r.title} 영상`} />
          <p className="mt-1 text-xs text-neutral-700">
            {job.sample ? "샘플 자료로 만든 영상" : "kiro-cli 조사 결과로 만든 영상"} · 약 {Math.round(r.videoSeconds ?? 0)}초 · 소리 없음
          </p>
        </div>
      )}      <div className="mt-2 flex flex-wrap gap-2">
        {r.artifactUrl && (
          <a href={r.artifactUrl} target="_blank" rel="noopener" data-testid="open-artifact" className="rounded-lg border-2 border-black bg-[#ffd23f] px-2 py-1 text-sm font-bold">
            {isProto ? "체험 페이지 열기" : spec.output === "video" ? "조사 자료(HTML) 열기" : spec.output === "calendar" ? (r.providerResourceId ? "Google Calendar에서 일정 열기" : "일정 판정 보기") : "HTML 열기"}
          </a>
        )}
        {r.videoDownloadUrl && (
          <a href={r.videoDownloadUrl} data-testid="download-video" className="rounded-lg border-2 border-black bg-[#7bd88f] px-2 py-1 text-sm font-bold">
            영상 내려받기(MP4)
          </a>
        )}
        {r.downloadUrl && !compact && (
          <>
            <label className="flex items-center gap-1 text-sm font-bold">
              <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} data-testid="review-check" className="h-4 w-4 accent-black" />
              내용을 확인했어요
            </label>
            {reviewed ? (
              <a href={r.downloadUrl} data-testid="download" className="rounded-lg border-2 border-black bg-white px-2 py-1 text-sm font-bold">
                HTML 내려받기
              </a>
            ) : (
              <span data-testid="download-locked" className="rounded-lg border-2 border-dashed border-black px-2 py-1 text-sm text-neutral-500">
                확인 후 내려받기
              </span>
            )}
          </>
        )}
</div>
      {onAck && (
        <button type="button" data-testid="ack" onClick={onAck} className={`${btn} mt-3 w-full bg-[#7bd88f] py-1.5 text-sm`}>
          ✓ 확인완료 (전체 결과함으로 보내기)
        </button>
      )}
      {!compact && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer font-bold">분석 범위·가정·Notion</summary>
          <ul className="mt-1 list-disc pl-5 text-neutral-700">
            {[...r.assumptions.map((a) => `가정: ${a}`), ...r.coverageNotes].map((n) => (
              <li key={n}>{n}</li>
            ))}
            <li>Notion: {r.notionSyncStatus === "synced" ? "기록됨" : r.notionSyncStatus === "not_configured" ? "연결 없음(앱에만 보관)" : r.notionSyncStatus === "failed" ? "실패" : "대기"}</li>
            {r.errors.map((e) => (
              <li key={e.code}>
                오류 {e.code}: {e.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
