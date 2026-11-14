// 런타임 생성 엔진: kiro-cli headless(V3). 이 PC에서 2026-11-14 실제 동작 확인.
// - 프롬프트는 stdin으로 넘긴다(명령 인자에 사용자 입력을 넣지 않는다).
// - 작업별 빈 sandbox 폴더에서 실행하고, 신뢰 도구는 호출자가 고른 읽기 전용 웹 도구만 허용한다.
// - 시간 상한을 넘기면 프로세스 트리를 종료한다.
import { spawn, spawnSync } from "node:child_process";

export interface KiroRunOptions {
  /** --trust-tools 값. 빈 배열이면 어떤 도구도 신뢰하지 않는다 */
  tools: string[];
  timeoutMs: number;
  cwd: string;
}

export interface KiroRun {
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  durationMs: number;
}

export type KiroRunner = (prompt: string, opts: KiroRunOptions) => Promise<KiroRun>;

// kiro-cli 3.3 V3에서 웹 검색 도구 ID는 remote_web_search(승인 이름 "remote/web_search")다.
// "web_search"만 신뢰하면 headless에서 승인 요청이 취소돼 검색이 전부 거부된다(2026-11-14 세션 로그로 확인, docs/integration-status.md).
export const WEB_TOOLS = ["web_fetch", "remote_web_search"];

export function kiroArgs(tools: string[], env: Record<string, string | undefined> = process.env): string[] {
  const args = ["chat", "--v3", "--no-interactive", `--trust-tools=${tools.join(",")}`];
  const model = env.JAMJARI_KIRO_MODEL?.trim();
  const effort = env.JAMJARI_KIRO_EFFORT?.trim();
  if (model && /^[\w.:-]{1,80}$/.test(model)) args.push("--model", model);
  if (effort && /^(low|medium|high|xhigh|max)$/.test(effort)) args.push("--effort", effort);
  return args;
}

export const runKiro: KiroRunner = (prompt, opts) =>
  new Promise((resolve) => {
    const started = Date.now();
    const bin = process.env.JAMJARI_KIRO_BIN?.trim() || "kiro-cli";
    const child = spawn(bin, kiroArgs(opts.tools), { cwd: opts.cwd, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let timedOut = false;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (d: string) => {
      if (stdout.length < 2_000_000) stdout += d;
    });
    // stderr에는 진행 로그가 나온다. 입력 원문이 섞일 수 있어 저장하지 않는다.
    child.stderr.resume();
    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === "win32" && child.pid) {
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
      } else child.kill("SIGKILL");
    }, opts.timeoutMs);
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ exitCode: null, timedOut, stdout, durationMs: Date.now() - started });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code, timedOut, stdout, durationMs: Date.now() - started });
    });
    child.stdin.end(prompt, "utf8");
  });

/** 설치·로그인 상태를 짧게 확인한다(워커 시작 시 1회) */
export function checkKiroInstalled(): { ok: boolean; detail: string } {
  const bin = process.env.JAMJARI_KIRO_BIN?.trim() || "kiro-cli";
  const r = spawnSync(bin, ["--version"], { encoding: "utf8", windowsHide: true, timeout: 15_000 });
  if (r.status === 0) return { ok: true, detail: r.stdout.trim() };
  return { ok: false, detail: r.error ? "kiro-cli를 찾을 수 없습니다" : `kiro-cli --version 종료 코드 ${r.status}` };
}
