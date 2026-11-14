import { describe, expect, it } from "vitest";
import { captureDate, outputsFor, validateCapture } from "./contracts";

describe("validateCapture — 여섯 경로 조합 (R1.3, AC-01)", () => {
  it("W1 개념·HTML: 메모만으로 허용", () => {
    const r = validateCapture({ purpose: "concept", output: "html", text: "RAG" });
    expect(r.ok).toBe(true);
    expect(r.workflow?.code).toBe("W1");
  });

  it("W2 개념·영상: URL+이미지 조합 허용", () => {
    const r = validateCapture({ purpose: "concept", output: "video", url: "https://example.com", image: { name: "a.png", type: "image/png", size: 10 } });
    expect(r.ok).toBe(true);
    expect(r.workflow?.code).toBe("W2");
  });

  it("요약에 영상 결과를 고르면 거부하고 허용 결과를 안내", () => {
    const r = validateCapture({ purpose: "summary", output: "video", url: "https://example.com" });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toBe("요약에서는 요약 HTML만 고를 수 있습니다.");
  });

  it("W3 아이디어에 URL을 넣으면 거부", () => {
    const r = validateCapture({ purpose: "idea", output: "html", text: "점심", url: "https://example.com" });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toContain("URL");
  });

  it("W4 체험은 메모가 필수", () => {
    const r = validateCapture({ purpose: "idea", output: "prototype" });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toContain("메모");
  });

  it("W5 요약은 URL만: 메모를 같이 넣으면 거부, URL만이면 허용", () => {
    expect(validateCapture({ purpose: "summary", output: "html", text: "메모", url: "https://a.com" }).ok).toBe(false);
    expect(validateCapture({ purpose: "summary", output: "html", text: "URL 없이" }).ok).toBe(false);
    expect(validateCapture({ purpose: "summary", output: "html", url: "https://a.com/x" }).workflow?.code).toBe("W5");
  });

  it("W6 일정: 아무 입력이 없으면 거부", () => {
    const r = validateCapture({ purpose: "schedule", output: "calendar", text: "   " });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("메모, URL, 이미지 중 하나 이상을 담아 주세요.");
  });

  it("http/https 이외 URL·큰 이미지·잘못된 형식 거부 (R1.4)", () => {
    expect(validateCapture({ purpose: "concept", output: "html", url: "javascript:alert(1)" }).ok).toBe(false);
    expect(validateCapture({ purpose: "concept", output: "html", url: "file:///etc/passwd" }).ok).toBe(false);
    expect(validateCapture({ purpose: "concept", output: "html", image: { name: "a.gif", type: "image/gif", size: 10 } }).ok).toBe(false);
    expect(validateCapture({ purpose: "concept", output: "html", image: { name: "a.png", type: "image/png", size: 5 * 1024 * 1024 + 1 } }).ok).toBe(false);
  });

  it("메모 5,000자 초과 거부", () => {
    expect(validateCapture({ purpose: "idea", output: "html", text: "가".repeat(5001) }).ok).toBe(false);
    expect(validateCapture({ purpose: "idea", output: "html", text: "가".repeat(5000) }).ok).toBe(true);
  });

  it("목적별 결과 형태 (R1.2)", () => {
    expect(outputsFor("concept").map((w) => w.output)).toEqual(["html", "video"]);
    expect(outputsFor("idea").map((w) => w.output)).toEqual(["html", "prototype"]);
    expect(outputsFor("summary").map((w) => w.output)).toEqual(["html"]);
    expect(outputsFor("schedule").map((w) => w.output)).toEqual(["calendar"]);
  });
});

describe("captureDate — 사용자 현지 날짜 (R1.6, AC-17)", () => {
  it("14:59Z = 23:59 KST → 11-14", () => {
    expect(captureDate(new Date("2026-11-14T14:59:00Z"))).toBe("2026-11-14");
  });
  it("15:00Z = 다음 날 00:00 KST → 11-15", () => {
    expect(captureDate(new Date("2026-11-14T15:00:00Z"))).toBe("2026-11-15");
  });
  it("다른 시간대 지정", () => {
    expect(captureDate(new Date("2026-11-14T15:00:00Z"), "UTC")).toBe("2026-11-14");
  });
});
