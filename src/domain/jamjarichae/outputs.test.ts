import { describe, expect, it } from "vitest";
import { SAMPLE_CONCEPT, SAMPLE_IDEAS, SAMPLE_PROTOTYPE } from "./fixtures";
import { checkIdeas, checkPrototypeHtml, ConceptResearchSchema, extractJson, IdeaReportSchema, PrototypeSchema } from "./outputs";

describe("checkIdeas (R3.5, AC-08)", () => {
  it("샘플 5개는 통과", () => {
    expect(IdeaReportSchema.parse(SAMPLE_IDEAS).ideas).toHaveLength(5);
    expect(checkIdeas(SAMPLE_IDEAS)).toEqual([]);
  });
  it("4개면 실패", () => {
    expect(checkIdeas({ ...SAMPLE_IDEAS, ideas: SAMPLE_IDEAS.ideas.slice(0, 4) })).toContain("아이디어가 4개입니다(정확히 5개 필요).");
  });
  it("이름 중복·바꾼 축 1개면 실패", () => {
    const ideas = SAMPLE_IDEAS.ideas.map((i) => ({ ...i }));
    ideas[1].name = ideas[0].name;
    ideas[2].axesChanged = ["who", "who"];
    const p = checkIdeas({ ...SAMPLE_IDEAS, ideas });
    expect(p).toContain("이름이 같은 아이디어가 있습니다.");
    expect(p.some((x) => x.startsWith("3번") && x.includes("1개"))).toBe(true);
  });
});

describe("checkPrototypeHtml (R3.6, AC-09)", () => {
  it("샘플 체험 페이지는 통과", () => {
    expect(PrototypeSchema.parse(SAMPLE_PROTOTYPE).title).toBe("오늘 점심 좁히기");
    expect(checkPrototypeHtml(SAMPLE_PROTOTYPE.html)).toEqual([]);
  });
  const ok = "<!doctype html><button id=b>눌러</button><script>b.onclick=function(){}</script>";
  it.each([
    ["fetch 호출", ok + "<script>fetch('/api/jamjari/jobs')</script>", "네트워크"],
    ["외부 스크립트", ok + '<script src="https://cdn.example.com/x.js"></script>', "외부 리소스"],
    ["프로토콜 상대 이미지", ok + '<img src="//evil.example/p.png">', "외부 리소스"],
    ["쿠키 접근", ok + "<script>document.cookie</script>", "저장소"],
    ["상위 창 접근", ok + "<script>window.parent.location='x'</script>", "상위 창"],
  ])("%s 차단", (_n, html, word) => {
    expect(checkPrototypeHtml(html).join(" ")).toContain(word);
  });
  it("스크립트·입력 요소가 없으면 실패", () => {
    const p = checkPrototypeHtml("<!doctype html><h1>소개 페이지</h1>");
    expect(p).toContain("스크립트가 없어 상호작용이 동작할 수 없습니다.");
    expect(p).toContain("누를 수 있는 입력 요소(button·input·select)가 없습니다.");
  });
});

describe("extractJson", () => {
  it("실행 로그 줄이 섞인 블록에서 JSON만 읽는다", () => {
    const out = '[tool] web_search\n<<<JSON\n{"a":1,\n[tool] status: Completed\n"b":"}"}\nJSON>>>\n';
    expect(extractJson(out)).toEqual({ a: 1, b: "}" });
  });
  it("```json 블록도 읽는다", () => {
    expect(extractJson('설명\n```json\n{"x":[1]}\n```')).toEqual({ x: [1] });
  });
  it("블록이 없으면 오류", () => {
    expect(() => extractJson("그냥 문장")).toThrow("no_json_block");
  });
  it("샘플 개념 조사 데이터가 스키마를 만족", () => {
    expect(ConceptResearchSchema.parse(SAMPLE_CONCEPT).sources[0].id).toBe("S1");
  });
});

describe("목록 개수 상한 (j_ffefff1abb396176 invalid_output 재발 방지)", () => {
  it("howItWorks 7개는 거부하지 않고 앞 6개만 쓴다", () => {
    const seven = ["1", "2", "3", "4", "5", "6", "7"];
    const r = ConceptResearchSchema.safeParse({ ...SAMPLE_CONCEPT, howItWorks: seven });
    expect(r.success).toBe(true);
    expect(r.data?.howItWorks).toEqual(["1", "2", "3", "4", "5", "6"]);
  });
  it("highlights 4개는 앞 3개, 빈 목록은 여전히 거부", () => {
    expect(ConceptResearchSchema.parse({ ...SAMPLE_CONCEPT, highlights: ["a", "b", "c", "d"] }).highlights).toEqual(["a", "b", "c"]);
    expect(ConceptResearchSchema.safeParse({ ...SAMPLE_CONCEPT, highlights: [] }).success).toBe(false);
  });
  it("문자열 길이 초과는 계속 거부", () => {
    expect(ConceptResearchSchema.safeParse({ ...SAMPLE_CONCEPT, oneLine: "가".repeat(401) }).success).toBe(false);
  });
  it("아이디어 개수는 자르지 않는다(9개면 거부, 6개는 checkIdeas가 판정)", () => {
    const six = [...SAMPLE_IDEAS.ideas, { ...SAMPLE_IDEAS.ideas[0], name: "여섯째" }];
    expect(IdeaReportSchema.parse({ ...SAMPLE_IDEAS, ideas: six }).ideas).toHaveLength(6);
    expect(checkIdeas({ ...SAMPLE_IDEAS, ideas: six })).toContain("아이디어가 6개입니다(정확히 5개 필요).");
    const nine = [...six, six[0], six[1], six[2]];
    expect(IdeaReportSchema.safeParse({ ...SAMPLE_IDEAS, ideas: nine }).success).toBe(false);
  });
});
