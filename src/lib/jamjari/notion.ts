// Notion 날짜별 기록. 계층: 루트 페이지 › 날짜(입력 현지 날짜) › 경로 › 작업. REST API만 쓰고 의존성은 추가하지 않는다.
import { workflowSpec } from "../../domain/jamjarichae/contracts.ts";
import type { Job, Result } from "../../domain/jamjarichae/job.ts";

const API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export class NotionError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface NotionConfig {
  token: string;
  rootPageId: string;
}

async function call(cfg: NotionConfig, f: FetchLike, method: "GET" | "POST", path: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await f(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${cfg.token}`, "Notion-Version": VERSION, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    // 응답 본문은 토큰이 없지만 길 수 있어 코드만 남긴다
    let code = "";
    try {
      code = String(((await res.json()) as { code?: string }).code ?? "");
    } catch {
      /* 본문 없음 */
    }
    throw new NotionError(`Notion ${res.status}${code ? ` ${code}` : ""}`, res.status);
  }
  return (await res.json()) as Record<string, unknown>;
}

export function readNotionConfig(env: Record<string, string | undefined>): NotionConfig | null {
  const token = env.NOTION_TOKEN?.trim();
  const rootPageId = env.NOTION_ROOT_PAGE_ID?.trim();
  return token && rootPageId ? { token, rootPageId: rootPageId.replace(/-/g, "") } : null;
}

const text = (s: string, max = 1900) => [{ type: "text", text: { content: s.length > max ? `${s.slice(0, max - 1)}…` : s } }];

/** 부모 아래에서 제목이 같은 자식 페이지를 찾고, 없으면 만든다 */
async function findOrCreateChild(cfg: NotionConfig, f: FetchLike, parentId: string, title: string): Promise<string> {
  let cursor: string | undefined;
  do {
    const q = `/blocks/${parentId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`;
    const page = (await call(cfg, f, "GET", q)) as { results: { id: string; type: string; child_page?: { title: string } }[]; has_more: boolean; next_cursor: string | null };
    const hit = page.results.find((b) => b.type === "child_page" && b.child_page?.title === title);
    if (hit) return hit.id;
    cursor = page.has_more && page.next_cursor ? page.next_cursor : undefined;
  } while (cursor);
  const created = await call(cfg, f, "POST", "/pages", {
    parent: { page_id: parentId },
    properties: { title: { title: text(title, 200) } },
  });
  return String(created.id);
}

const para = (s: string) => ({ object: "block", type: "paragraph", paragraph: { rich_text: text(s) } });
const bullet = (s: string) => ({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: text(s) } });
const heading = (s: string) => ({ object: "block", type: "heading_2", heading_2: { rich_text: text(s, 200) } });

export function buildBlocks(job: Job, result: Result): unknown[] {
  const blocks: unknown[] = [
    para(`상태: ${result.status}${job.sample ? " (샘플)" : ""} · 입력 날짜: ${job.captureDate}`),
    ...(job.input.text ? [heading("입력"), para(job.input.text)] : []),
    ...(job.input.url ? [para(`URL: ${job.input.url}`)] : []),
  ];
  if (result.highlights.length) blocks.push(heading("핵심 발견"), ...result.highlights.map(bullet));
  if (result.nextAction) blocks.push(heading("다음 행동"), para(result.nextAction));
  if (result.sources.length) blocks.push(heading("출처"), ...result.sources.slice(0, 20).map((s) => bullet(`${s.title ?? s.url} ${s.url}`)));
  if (result.coverageNotes.length) blocks.push(heading("확인한 범위"), ...result.coverageNotes.slice(0, 20).map(bullet));
  return blocks.slice(0, 95);
}

/** 작업 결과를 날짜 › 경로 아래 새 페이지로 기록하고 페이지 URL을 돌려준다 */
export async function syncJobToNotion(cfg: NotionConfig, job: Job, result: Result, f: FetchLike = fetch): Promise<string> {
  const spec = workflowSpec(job.workflow);
  const dateId = await findOrCreateChild(cfg, f, cfg.rootPageId, job.captureDate);
  const wfId = await findOrCreateChild(cfg, f, dateId, `${job.workflow} · ${spec.outputLabel}`);
  const page = await call(cfg, f, "POST", "/pages", {
    parent: { page_id: wfId },
    properties: { title: { title: text(`${result.title} (${job.id})`, 200) } },
    children: buildBlocks(job, result),
  });
  return String(page.url);
}
