import { describe, expect, it } from "vitest";
import { assertPublicUrl, fetchPublicPage, htmlToText, isPrivateAddress } from "./fetch-url";

const publicDns = async () => ["93.184.215.14"];

describe("isPrivateAddress (R5.3)", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.0.10", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])("%s 차단", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });
  it.each(["93.184.215.14", "8.8.8.8", "2606:4700::1111"])("%s 허용", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe("assertPublicUrl", () => {
  it("localhost·내부 IP·DNS가 사설로 풀리는 주소·비 http 거부", async () => {
    await expect(assertPublicUrl("http://localhost:3000/api", publicDns)).rejects.toThrow();
    await expect(assertPublicUrl("http://169.254.169.254/latest/meta-data", publicDns)).rejects.toThrow();
    await expect(assertPublicUrl("https://intranet.example", async () => ["10.0.0.5"])).rejects.toThrow("사설");
    await expect(assertPublicUrl("ftp://example.com", publicDns)).rejects.toThrow("http/https");
    await expect(assertPublicUrl("https://user:pw@example.com", publicDns)).rejects.toThrow("계정");
  });
  it("공개 주소 통과", async () => {
    expect((await assertPublicUrl("https://example.com/a", publicDns)).hostname).toBe("example.com");
  });
});

describe("fetchPublicPage", () => {
  it("리다이렉트가 내부 주소로 가면 차단", async () => {
    const fetchImpl = (async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } })) as typeof fetch;
    await expect(fetchPublicPage("https://example.com", { resolve: publicDns, fetchImpl })).rejects.toThrow();
  });
  it("HTML 본문을 텍스트로 (script 제거)", async () => {
    const fetchImpl = (async () =>
      new Response("<html><title>제목 &amp; 부제</title><script>evil()</script><p>본문 1</p><p>본문 2</p></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      })) as typeof fetch;
    const page = await fetchPublicPage("https://example.com", { resolve: publicDns, fetchImpl });
    expect(page.title).toBe("제목 & 부제");
    expect(page.text).toContain("본문 1");
    expect(page.text).not.toContain("evil");
  });
  it("텍스트가 아닌 응답은 거부", async () => {
    const fetchImpl = (async () => new Response("x", { status: 200, headers: { "content-type": "application/pdf" } })) as typeof fetch;
    await expect(fetchPublicPage("https://example.com/a.pdf", { resolve: publicDns, fetchImpl })).rejects.toThrow("텍스트 페이지가 아닙니다");
  });
});

describe("htmlToText", () => {
  it("style·noscript 제거, 엔티티 복원", () => {
    expect(htmlToText("<style>a{}</style><div>A&lt;B</div><noscript>x</noscript>").text).toBe("A<B");
  });
});
