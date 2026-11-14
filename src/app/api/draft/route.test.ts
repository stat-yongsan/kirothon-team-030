import { afterEach, describe, expect, it, vi } from "vitest";
import { currentDomain } from "@/domain/current";
import { POST } from "./route";

// 주제와 무관한 API 경계 테스트: 활성 도메인의 샘플에서 정상·오류 입력을 고른다.
const validSample = currentDomain.samples.find((s) => currentDomain.analyze(s.content).canDraft);
const invalidSample = currentDomain.samples.find((s) => !currentDomain.analyze(s.content).canDraft);
if (!validSample || !invalidSample) {
  throw new Error("DomainAdapter.samples에는 초안 가능한 샘플과 오류 샘플이 각각 1개 이상 필요합니다");
}
const validInput = validSample.content;
const invalidInput = invalidSample.content;

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost/api/draft", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/draft", () => {
  it("mock 모드: 정상 입력에 샘플 응답을 돌려준다", async () => {
    vi.stubEnv("AI_MODE", "mock");
    const res = await post({ input: validInput });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe("mock");
    expect(data.draft.sections.length).toBeGreaterThan(0);
  });

  it("입력 오류가 있으면 AI를 호출하지 않고 422", async () => {
    vi.stubEnv("AI_MODE", "mock");
    const res = await post({ input: invalidInput });
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("input_invalid");
  });

  it("live 모드에서 키가 없으면 503 config 오류(샘플로 대체하지 않음)", async () => {
    vi.stubEnv("AI_MODE", "live");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post({ input: validInput });
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error.code).toBe("config");
    expect(data.draft).toBeUndefined();
    spy.mockRestore();
  });

  it("프로덕션 live 모드는 DRAFT_ACCESS_CODE가 없으면 호출하지 않는다", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_MODE", "live");
    vi.stubEnv("DRAFT_ACCESS_CODE", "");
    const res = await post({ input: validInput });
    expect(res.status).toBe(503);
    expect((await res.json()).error.message).toContain("DRAFT_ACCESS_CODE");
  });

  it("live 모드: 접근 코드가 없거나 틀리면 401, 맞으면 다음 단계(키 확인)로 진행", async () => {
    vi.stubEnv("AI_MODE", "live");
    vi.stubEnv("DRAFT_ACCESS_CODE", "open-sesame");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const headers of [{}, { "x-access-code": "wrong" }] as Record<string, string>[]) {
      const res = await post({ input: validInput }, headers);
      expect(res.status).toBe(401);
      expect((await res.json()).error.code).toBe("access_denied");
    }
    const ok = await post({ input: validInput }, { "x-access-code": "open-sesame" });
    expect(ok.status).toBe(503); // 접근 통과 후 키 없음으로 멈춤 — 실제 호출 없음
    expect((await ok.json()).error.message).toContain("ANTHROPIC_API_KEY");
    spy.mockRestore();
  });

  it("mock 모드는 비용이 없으므로 접근 코드 없이 동작한다", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_MODE", "mock");
    vi.stubEnv("DRAFT_ACCESS_CODE", "open-sesame");
    expect((await post({ input: validInput })).status).toBe(200);
  });

  it("잘못된 본문과 과도한 입력을 거부한다", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post({ input: 3 })).status).toBe(400);
    expect((await post({ input: "   " })).status).toBe(400);
    expect((await post({ input: "x".repeat(100_001) })).status).toBe(413);
  });
});
