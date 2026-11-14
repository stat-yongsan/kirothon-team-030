// API 경계 테스트 (tasks 5): Route Handler를 직접 호출한다. 저장소는 임시 폴더.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getJob, saveArtifact, updateJob } from "@/lib/jamjari/store";

// connection()은 Next 요청 컨텍스트 밖에서는 쓸 수 없어 테스트에서는 비운다(동적 렌더링 표시 용도)
vi.mock("next/server", () => ({ connection: async () => {} }));

const jobsRoute = await import("./jobs/route");
const runRoute = await import("./run/route");
const answerRoute = await import("./jobs/[id]/answer/route");
const cancelRoute = await import("./jobs/[id]/cancel/route");
const reportRoute = await import("../../r/[id]/route");
const protoRawRoute = await import("../../p/[id]/raw/route");
const protoRoute = await import("../../p/[id]/route");

const BASE = "http://localhost:3000";
let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jamjari-api-"));
  process.env.JAMJARI_DATA_DIR = dir;
});
afterEach(() => {
  delete process.env.JAMJARI_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

function form(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

function postCapture(fields: Record<string, string>, headers: Record<string, string> = { "x-jamjari": "1" }) {
  return jobsRoute.POST(new Request(`${BASE}/api/jamjari/jobs`, { method: "POST", body: form(fields), headers }));
}

function postJson(url: string, body: unknown, headers: Record<string, string> = { "x-jamjari": "1" }) {
  return new Request(`${BASE}${url}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("쓰기 요청 가드", () => {
  it("x-jamjari 헤더가 없으면 403 missing_header, 저장하지 않음", async () => {
    const res = await postCapture({ purpose: "idea", output: "html", text: "메모" }, {});
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("missing_header");
    const list = await (await jobsRoute.GET(new Request(`${BASE}/api/jamjari/jobs`))).json();
    expect(list.jobs).toHaveLength(0);
  });
  it("다른 Origin이면 헤더가 있어도 403 cross_origin", async () => {
    const res = await postCapture({ purpose: "idea", output: "html", text: "메모" }, { "x-jamjari": "1", origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("cross_origin");
  });
  it("같은 Origin은 통과", async () => {
    const res = await postCapture({ purpose: "idea", output: "html", text: "메모" }, { "x-jamjari": "1", origin: BASE });
    expect(res.status).toBe(201);
  });
  it("맡기기·취소·답변도 헤더 없으면 403", async () => {
    expect((await runRoute.POST(postJson("/api/jamjari/run", {}, {}))).status).toBe(403);
    expect((await cancelRoute.POST(postJson("/api/jamjari/jobs/j_0000000000000000/cancel", {}, {}), params("j_0000000000000000"))).status).toBe(403);
    expect((await answerRoute.POST(postJson("/api/jamjari/jobs/j_0000000000000000/answer", { answer: "a" }, {}), params("j_0000000000000000"))).status).toBe(403);
  });
});

describe("생각 담기 POST /api/jamjari/jobs (R1.3, R1.5)", () => {
  it.each([
    ["아이디어·HTML에 URL만", { purpose: "idea", output: "html", url: "https://example.com" }],
    ["요약에 메모만", { purpose: "summary", output: "html", text: "요약해 줘" }],
    ["요약에 메모+URL", { purpose: "summary", output: "html", text: "메모", url: "https://example.com" }],
    ["입력 없음", { purpose: "concept", output: "html" }],
    ["목적에 없는 결과 형태", { purpose: "summary", output: "video", url: "https://example.com" }],
  ])("%s → 422 invalid_capture, 허용 조합 안내", async (_n, fields) => {
    const res = await postCapture(fields);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_capture");
    expect(body.error.details.length).toBeGreaterThan(0);
  });
  it("알 수 없는 목적 값은 400", async () => {
    expect((await postCapture({ purpose: "hack", output: "html", text: "x" })).status).toBe(400);
  });
  it("담기 201(draft), 같은 클릭 키로 다시 보내면 200·같은 작업", async () => {
    const fields = { purpose: "idea", output: "prototype", text: "점심 메뉴 고르기", idempotencyKey: "click-key-0001" };
    const first = await postCapture(fields);
    expect(first.status).toBe(201);
    const a = await first.json();
    expect(a.created).toBe(true);
    expect(a.job.status).toBe("draft");
    const second = await postCapture(fields);
    expect(second.status).toBe(200);
    const b = await second.json();
    expect(b.created).toBe(false);
    expect(b.job.id).toBe(a.job.id);
    const list = await (await jobsRoute.GET(new Request(`${BASE}/api/jamjari/jobs`))).json();
    expect(list.jobs).toHaveLength(1);
  });
  it("PNG가 아닌 내용을 image/png로 보내면 422", async () => {
    const f = form({ purpose: "concept", output: "html" });
    f.set("image", new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])], "x.png", { type: "image/png" }));
    const res = await jobsRoute.POST(new Request(`${BASE}/api/jamjari/jobs`, { method: "POST", body: f, headers: { "x-jamjari": "1" } }));
    expect(res.status).toBe(422);
  });
});

describe("맡기기·취소·답변 (R2.1, R2.7, R4.4, R5.6)", () => {
  it("맡기기는 draft만 queued로 바꾼다", async () => {
    const a = (await (await postCapture({ purpose: "idea", output: "html", text: "하나" })).json()).job.id as string;
    const b = (await (await postCapture({ purpose: "concept", output: "html", text: "둘" })).json()).job.id as string;
    const res = await runRoute.POST(postJson("/api/jamjari/run", {}));
    expect(res.status).toBe(200);
    expect(((await res.json()).queued as string[]).sort()).toEqual([a, b].sort());
    expect(getJob(a)?.status).toBe("queued");
    // 두 번째 맡기기는 옮길 draft가 없다
    expect((await (await runRoute.POST(postJson("/api/jamjari/run", {}))).json()).queued).toEqual([]);
  });
  it("맡기기 본문이 JSON이 아니면 400", async () => {
    const req = new Request(`${BASE}/api/jamjari/run`, { method: "POST", body: "{not json", headers: { "x-jamjari": "1" } });
    expect((await runRoute.POST(req)).status).toBe(400);
  });
  it("실행 전 작업 취소 → cancelled, 끝난 작업 취소 → 409", async () => {
    const id = (await (await postCapture({ purpose: "idea", output: "html", text: "취소할 생각" })).json()).job.id as string;
    const res = await cancelRoute.POST(postJson(`/api/jamjari/jobs/${id}/cancel`, {}), params(id));
    expect(res.status).toBe(200);
    expect((await res.json()).job.status).toBe("cancelled");
    expect((await cancelRoute.POST(postJson(`/api/jamjari/jobs/${id}/cancel`, {}), params(id))).status).toBe(409);
  });
  it("없는 ID·경로 조작 ID는 404", async () => {
    for (const id of ["j_ffffffffffffffff", "../../etc/passwd"]) {
      expect((await cancelRoute.POST(postJson(`/api/jamjari/jobs/x/cancel`, {}), params(id))).status).toBe(404);
    }
  });
  it("답변: needs_input이면 저장 후 queued, 아니면 409, 빈 답은 422", async () => {
    const id = (await (await postCapture({ purpose: "concept", output: "html", text: "MCP" })).json()).job.id as string;
    expect((await answerRoute.POST(postJson(`/api/jamjari/jobs/${id}/answer`, { answer: "모델 컨텍스트 프로토콜" }), params(id))).status).toBe(409);
    updateJob(id, (j) => {
      j.status = "needs_input";
      j.question = { text: "어떤 MCP인가요?", answer: null };
    });
    expect((await answerRoute.POST(postJson(`/api/jamjari/jobs/${id}/answer`, { answer: "   " }), params(id))).status).toBe(422);
    const res = await answerRoute.POST(postJson(`/api/jamjari/jobs/${id}/answer`, { answer: "모델 컨텍스트 프로토콜" }), params(id));
    expect(res.status).toBe(200);
    expect(getJob(id)?.status).toBe("queued");
    expect(getJob(id)?.question?.answer).toBe("모델 컨텍스트 프로토콜");
  });
  it("W2 외부 조치 링크는 http/https만", async () => {
    const id = (await (await postCapture({ purpose: "concept", output: "video", text: "RAG" })).json()).job.id as string;
    updateJob(id, (j) => {
      j.status = "awaiting_external_action";
      j.result = { jobId: j.id, workflow: j.workflow, status: "partial", title: "RAG", highlights: [], artifactType: "html_report", notionSyncStatus: "not_configured", assumptions: [], coverageNotes: [], sources: [], errors: [], engine: "kiro-cli" };
    });
    expect((await answerRoute.POST(postJson(`/api/jamjari/jobs/${id}/answer`, { answer: "javascript:alert(1)" }), params(id))).status).toBe(422);
    const ok = await answerRoute.POST(postJson(`/api/jamjari/jobs/${id}/answer`, { answer: "https://example.com/video" }), params(id));
    expect(ok.status).toBe(200);
    expect(getJob(id)?.result?.userLinkUrl).toBe("https://example.com/video");
  });
});

describe("보고서·체험 뷰어 (R3.6, R5.4, R5.6)", () => {
  const AID = "a_0123456789abcdef";
  it("보고서 /r/{id}: 스크립트 불허 CSP, download=1이면 attachment, 없는 ID 404", async () => {
    saveArtifact(AID, "<!doctype html><h1>보고서</h1>", "html");
    const res = await reportRoute.GET(new Request(`${BASE}/r/${AID}`), params(AID));
    expect(res.status).toBe(200);
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain("script-src");
    expect(res.headers.get("content-disposition")).toBeNull();
    const dl = await reportRoute.GET(new Request(`${BASE}/r/${AID}?download=1`), params(AID));
    expect(dl.headers.get("content-disposition")).toContain("attachment");
    expect((await reportRoute.GET(new Request(`${BASE}/r/x`), params("../jobs/j_0000000000000000"))).status).toBe(404);
  });
  it("체험 /p/{id}: sandbox=allow-scripts iframe(same-origin 없음), raw는 CSP sandbox·connect-src 'none'", async () => {
    saveArtifact(AID, "<!doctype html><button>눌러</button><script>1</script>", "html");
    const page = await protoRoute.GET(new Request(`${BASE}/p/${AID}`), params(AID));
    const html = await page.text();
    expect(html).toContain('sandbox="allow-scripts"');
    expect(html).not.toContain("allow-same-origin");
    const raw = await protoRawRoute.GET(new Request(`${BASE}/p/${AID}/raw`), params(AID));
    const csp = raw.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("sandbox allow-scripts");
    expect(csp).toContain("connect-src 'none'");
    expect(csp).not.toContain("allow-same-origin");
    expect((await protoRoute.GET(new Request(`${BASE}/p/x`), params("a_missing"))).status).toBe(404);
  });
});
