// W5 유튜브 어댑터: yt-dlp로 메타데이터·자막, ffmpeg로 실제 프레임 캡처.
// video-lens(커밋 669491b)는 youtube_transcript_api를 쓰지만 이 PC에는 없어서 같은 단계(메타데이터·자막 확보)를 yt-dlp로 대신한다.
// 사용자 입력은 영상 ID 정규식으로만 통과시키고, 명령은 셸 없이 인자 배열로 실행한다.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const YT_LIMITS = { maxSeconds: 20 * 60, maxScenes: 6, toolTimeoutMs: 90_000 };

export function parseYouTubeId(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "music.youtube.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/]+)/);
      if (m) id = m[2];
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

function run(bin: string, args: string[], timeoutMs: number): Promise<{ code: number | null; stdout: string }> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (d: string) => {
      if (stdout.length < 20_000_000) stdout += d;
    });
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ code: null, stdout });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout });
    });
  });
}

export interface YouTubeMeta {
  id: string;
  title: string;
  channel: string | null;
  durationSeconds: number | null;
  uploadDate: string | null;
}

export class YouTubeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

export async function fetchMeta(id: string): Promise<YouTubeMeta> {
  const r = await run("yt-dlp", ["--dump-single-json", "--skip-download", "--no-warnings", "--no-playlist", watchUrl(id)], YT_LIMITS.toolTimeoutMs);
  if (r.code === null) throw new YouTubeError("tool_missing", "yt-dlp를 실행하지 못했습니다.");
  if (r.code !== 0) throw new YouTubeError("unavailable", "영상 정보를 읽지 못했습니다(비공개·연령 제한·지역 제한일 수 있음).");
  const j = JSON.parse(r.stdout) as Record<string, unknown>;
  const ud = typeof j.upload_date === "string" ? j.upload_date : null;
  return {
    id,
    title: String(j.title ?? `YouTube ${id}`),
    channel: typeof j.channel === "string" ? j.channel : null,
    durationSeconds: typeof j.duration === "number" ? Math.round(j.duration) : null,
    uploadDate: ud && /^\d{8}$/.test(ud) ? `${ud.slice(0, 4)}-${ud.slice(4, 6)}-${ud.slice(6)}` : null,
  };
}

/** WebVTT → "[m:ss] 문장" 줄. 자동 자막의 반복 줄을 합친다 */
export function vttToLines(vtt: string): string[] {
  const out: string[] = [];
  let last = "";
  const blocks = vtt.replace(/\r/g, "").split("\n\n");
  for (const b of blocks) {
    const m = b.match(/(\d{2}):(\d{2}):(\d{2})\.\d{3}\s+-->/);
    if (!m) continue;
    const secs = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    const text = b
      .split("\n")
      .filter((l) => !l.includes("-->") && !/^\d+$/.test(l.trim()))
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text || text === last) continue;
    if (last && text.startsWith(last)) out.pop();
    last = text;
    const h = Math.floor(secs / 3600);
    const mm = Math.floor((secs % 3600) / 60);
    const ss = secs % 60;
    out.push(`[${h ? `${h}:${String(mm).padStart(2, "0")}` : mm}:${String(ss).padStart(2, "0")}] ${text}`);
  }
  return out;
}

export async function fetchTranscript(id: string, dir: string): Promise<{ lang: string; lines: string[] } | null> {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (f.startsWith("sub.")) fs.rmSync(path.join(dir, f), { force: true });
  await run(
    "yt-dlp",
    ["--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", "ko,ko-orig,en,en-orig", "--sub-format", "vtt", "--no-warnings", "--no-playlist", "-o", path.join(dir, "sub.%(ext)s"), watchUrl(id)],
    YT_LIMITS.toolTimeoutMs,
  );
  const files = fs.readdirSync(dir).filter((f) => f.startsWith("sub.") && f.endsWith(".vtt"));
  const order = ["ko", "ko-orig", "en", "en-orig"];
  files.sort((a, b) => order.indexOf(a.split(".")[1]) - order.indexOf(b.split(".")[1]));
  for (const f of files) {
    const lines = vttToLines(fs.readFileSync(path.join(dir, f), "utf8"));
    if (lines.length > 0) return { lang: f.split(".")[1], lines };
  }
  return null;
}

/** 실제 영상 스트림에서 지정 시각의 프레임을 JPEG로 뽑는다. 실패한 시각은 건너뛴다 */
export async function captureFrames(id: string, seconds: number[], dir: string): Promise<{ seconds: number; file: string }[]> {
  // 프레임만 필요하므로 영상 전용 스트림을 먼저 고른다. 2026-11-14 확인: 결합 포맷(18 등)은 목록에 있어도 -g로 선택되지 않았다.
  const g = await run("yt-dlp", ["-g", "-f", "bv*[height<=480][ext=mp4]/bv*[height<=480]/wv*/best[height<=480]/worst", "--no-warnings", "--no-playlist", watchUrl(id)], YT_LIMITS.toolTimeoutMs);
  const stream = g.code === 0 ? g.stdout.split(/\r?\n/).find((l) => l.startsWith("https://")) : null;
  if (!stream) return [];
  const out: { seconds: number; file: string }[] = [];
  for (const s of seconds.slice(0, YT_LIMITS.maxScenes)) {
    const file = path.join(dir, `scene-${s}.jpg`);
    const r = await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", String(s), "-i", stream, "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "5", "-y", file], 60_000);
    if (r.code === 0 && fs.existsSync(file) && fs.statSync(file).size > 0) out.push({ seconds: s, file });
  }
  return out;
}
