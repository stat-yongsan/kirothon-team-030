// W2 영상 렌더: HyperFrames CLI(로컬, Apache-2.0)를 셸 없이 인자 배열로 실행한다. 외부 영상 API·계정이 필요 없다.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface VideoRenderResult {
  ok: boolean;
  /** 성공하면 만들어진 MP4의 절대 경로 */
  file?: string;
  code?: "cli_missing" | "timeout" | "render_error" | "no_output";
  message?: string;
}

export type VideoRenderer = (dir: string) => Promise<VideoRenderResult>;

function cliPath(): string | null {
  const p = path.join(process.cwd(), "node_modules", "hyperframes", "bin", "hyperframes.mjs");
  return fs.existsSync(p) ? p : null;
}

/** dir/index.html 을 dir/out.mp4 로 렌더한다. 기본 상한 8분 */
export function renderWithHyperframes(timeoutMs = 8 * 60_000): VideoRenderer {
  return (dir) =>
    new Promise((resolve) => {
      const cli = cliPath();
      if (!cli) return resolve({ ok: false, code: "cli_missing", message: "hyperframes CLI가 설치되어 있지 않습니다(npm install 필요)." });
      const out = path.join(dir, "out.mp4");
      fs.rmSync(out, { force: true });
      const env: Record<string, string> = { HYPERFRAMES_NO_TELEMETRY: "1", DO_NOT_TRACK: "1" };
      // 비밀값은 넘기지 않고 실행에 필요한 시스템 변수만 넘긴다
      for (const k of ["PATH", "Path", "SystemRoot", "TEMP", "TMP", "USERPROFILE", "HOME", "APPDATA", "LOCALAPPDATA"]) if (process.env[k]) env[k] = process.env[k] as string;
      const child = spawn(process.execPath, [cli, "render", "--output", out, "--quality", "draft", "--quiet"], {
        cwd: dir,
        windowsHide: true,
        stdio: ["ignore", "ignore", "pipe"],
        env: env as NodeJS.ProcessEnv,
      });
      let stderr = "";
      let timedOut = false;
      child.stderr.on("data", (d: Buffer) => {
        stderr = (stderr + d.toString("utf8")).slice(-2000);
      });
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMs);
      child.on("error", () => {
        clearTimeout(timer);
        resolve({ ok: false, code: "render_error", message: "렌더 프로세스를 시작하지 못했습니다." });
      });
      child.on("close", (exitCode) => {
        clearTimeout(timer);
        if (timedOut) return resolve({ ok: false, code: "timeout", message: `영상 렌더가 ${Math.round(timeoutMs / 1000)}초 안에 끝나지 않았습니다.` });
        if (exitCode !== 0) {
          const tail = stderr.trim().split(/\r?\n/).slice(-2).join(" ").slice(0, 200);
          return resolve({ ok: false, code: "render_error", message: `영상 렌더 종료 코드 ${exitCode}${tail ? `: ${tail}` : ""}` });
        }
        if (!fs.existsSync(out) || fs.statSync(out).size < 1024) return resolve({ ok: false, code: "no_output", message: "렌더는 끝났지만 MP4 파일이 없습니다." });
        resolve({ ok: true, file: out });
      });
    });
}
