#!/usr/bin/env node
// 환경·도구·설정 유무 점검. 비밀값과 계정 식별 정보는 출력하지 않는다.
//   node scripts/doctor.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rows = [];
const add = (status, item, detail) => rows.push({ status, item, detail });
const exists = (p) => fs.existsSync(path.join(ROOT, p));

function version(cmd) {
  // 고정 문자열 명령만 실행한다(사용자 입력 없음). Windows의 .cmd 실행을 위해 shell 사용.
  const r = spawnSync(cmd, { shell: true, encoding: "utf8", windowsHide: true, timeout: 20_000 });
  return r.status === 0 ? (r.stdout || r.stderr).trim().split(/\r?\n/)[0] : null;
}

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return null;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

// --- 실행 환경 ---
const wsl = Boolean(process.env.WSL_DISTRO_NAME);
add(process.platform === "win32" && !wsl ? "PASS" : "WARN", "OS", `${process.platform}${wsl ? " (WSL)" : " (Windows 네이티브)"}`);
const [maj, min] = process.versions.node.split(".").map(Number);
add(maj > 20 || (maj === 20 && min >= 9) ? "PASS" : "FAIL", "Node", `v${process.versions.node} (Next 16: ≥20.9)`);
const npm = version(process.platform === "win32" ? "npm.cmd -v" : "npm -v");
add(npm ? "PASS" : "FAIL", "npm", npm ?? "없음");
const git = version("git --version");
add(git ? "PASS" : "WARN", "Git", git ?? "없음");
const gh = version("gh --version");
add(gh ? "PASS" : "WARN", "GitHub CLI", gh ? `${gh} (로그인 계정은 docs/local-setup.md에서 확인)` : "없음 — 웹에서 저장소 생성 가능");
// 커밋 이메일이 GitHub noreply인지(개인 이메일 공개 방지), gh 활성 계정이 origin 저장소 소유자인지. 이메일 값은 출력하지 않는다.
const sh = (cmd) => spawnSync(cmd, { cwd: ROOT, shell: true, encoding: "utf8", windowsHide: true, timeout: 20_000 }).stdout?.trim() ?? "";
const commitEmail = sh("git config user.email");
add(/@users\.noreply\.github\.com$/.test(commitEmail) ? "PASS" : "WARN", "커밋 이메일", /@users\.noreply\.github\.com$/.test(commitEmail) ? "GitHub noreply (개인 이메일 비공개)" : "noreply가 아님 — push하면 커밋에 이메일이 공개됨");
const owner = sh("git remote get-url origin").match(/github\.com[/:]([^/]+)\//)?.[1];
if (gh && owner) {
  const login = sh("gh api user --jq .login");
  add(login === owner ? "PASS" : "WARN", "GitHub 계정", login === owner ? `gh 활성 계정 = 저장소 소유자 ${owner}` : `gh 활성 계정이 ${owner}가 아님 — gh auth switch --user ${owner}`);
}
const vercel = version("vercel --version");
add(vercel ? "PASS" : "WARN", "Vercel CLI", vercel ?? "전역 설치 없음 — npx.cmd vercel@latest 사용");

const kiroCli = version("kiro-cli --version");
add(kiroCli ? "PASS" : "FAIL", "kiro-cli", kiroCli ?? "없음 — 해커톤 기본 도구");
if (kiroCli) {
  // whoami 출력에는 계정 이메일이 있으므로 성공 여부만 본다.
  const who = spawnSync("kiro-cli whoami", { shell: true, encoding: "utf8", windowsHide: true, timeout: 20_000 });
  add(who.status === 0 && /Logged in/i.test(who.stdout) ? "PASS" : "FAIL", "kiro-cli 로그인", who.status === 0 ? "로그인됨 (계정은 kiro-cli whoami로 직접 확인)" : "kiro-cli login 필요");
  // Figma는 선택. 원격 MCP 등록 + builder tools의 @figma가 있어야 builder가 Figma 도구를 본다(OAuth는 채팅에서 Ctrl+Y).
  const mcp = spawnSync("kiro-cli mcp list", { cwd: ROOT, shell: true, encoding: "utf8", windowsHide: true, timeout: 20_000 });
  const builderTools = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, ".kiro/agents/builder.json"), "utf8")).tools ?? []; } catch { return []; } })();
  const figmaOk = /\bfigma\b/.test(String(mcp.stdout)+String(mcp.stderr)) && builderTools.includes("@figma");
  add(figmaOk ? "PASS" : "WARN", "Figma MCP", figmaOk ? "등록됨 + builder @figma (로그인 요청이 뜨면 채팅에서 Ctrl+Y)" : "README 6절 — 없어도 기본 UI로 진행");
}

if (process.platform === "win32") {
  const edge = ["ProgramFiles(x86)", "ProgramFiles"]
    .map((k) => path.join(process.env[k] ?? "", "Microsoft", "Edge", "Application", "msedge.exe"))
    .find((p) => fs.existsSync(p));
  add(edge ? "PASS" : "WARN", "Microsoft Edge", edge ? "설치됨 (Playwright MCP --browser msedge)" : "없음");
}

// --- 프로젝트 ---
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const needScripts = ["dev", "lint", "typecheck", "test", "build"];
const missingScripts = needScripts.filter((s) => !pkg.scripts?.[s]);
add(missingScripts.length ? "FAIL" : "PASS", "npm scripts", missingScripts.length ? `누락: ${missingScripts.join(", ")}` : needScripts.join(", "));
for (const dep of ["next", "@anthropic-ai/sdk", "vitest", "eslint", "typescript"]) {
  const p = path.join(ROOT, "node_modules", dep, "package.json");
  add(fs.existsSync(p) ? "PASS" : "FAIL", `패키지 ${dep}`, fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")).version : "미설치 — npm.cmd install");
}
add(exists("package-lock.json") ? "PASS" : "FAIL", "lockfile", "package-lock.json");

// --- 환경변수(값은 출력하지 않음, 단 AI_MODE/모델 ID는 비밀 아님) ---
const envLocal = parseEnvFile(path.join(ROOT, ".env.local"));
const env = { ...(envLocal ?? {}), ...process.env };
const mode = (env.AI_MODE ?? "mock").trim() || "mock";
add(["mock", "live"].includes(mode) ? "PASS" : "FAIL", "AI_MODE", `${mode}${envLocal ? " (.env.local)" : " (.env.local 없음 → 기본 mock)"}`);
add("PASS", "ANTHROPIC_MODEL", env.ANTHROPIC_MODEL?.trim() || "미지정 → 코드 기본값 claude-opus-5-5");
const hasKey = Boolean(env.ANTHROPIC_API_KEY?.trim());
add(hasKey ? "PASS" : mode === "live" ? "FAIL" : "WARN", "ANTHROPIC_API_KEY", hasKey ? "설정됨(값 비공개)" : "없음 — live 시연 전 .env.local에 설정");
const publicLeak = Object.keys(env).filter((k) => /^NEXT_PUBLIC_.*(ANTHROPIC|API_KEY|SECRET)/i.test(k));
add(publicLeak.length ? "FAIL" : "PASS", "클라이언트 노출 변수", publicLeak.length ? `금지: ${publicLeak.join(", ")}` : "NEXT_PUBLIC_ 비밀값 없음");
const example = parseEnvFile(path.join(ROOT, ".env.example"));
add(example && !example.ANTHROPIC_API_KEY ? "PASS" : "FAIL", ".env.example", example ? "키 값 비어 있음" : "없음");

// --- gitignore ---
const gi = exists(".gitignore") ? fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8") : "";
const needIgnore = [".env*", "!.env.example", "docs/local-setup.md", "CLAUDE_CODE_KIRO_HANDOFF.md", ".kiro/runs/"];
const missIgnore = needIgnore.filter((l) => !gi.split(/\r?\n/).includes(l));
add(missIgnore.length ? "FAIL" : "PASS", ".gitignore", missIgnore.length ? `누락: ${missIgnore.join(", ")}` : "비밀·로컬 문서·실행 로그 제외");

// --- Kiro 설정 파일(생성 여부와 문법. 에이전트는 kiro-cli agent validate로 확인) ---
const kiroFiles = [
  "AGENTS.md",
  "CLAUDE.md",
  "challenge.md",
  ".kiro/specs/mvp/requirements.md",
  ".kiro/specs/mvp/design.md",
  ".kiro/specs/mvp/tasks.md",
  ".kiro/steering/product.md",
  ".kiro/steering/tech.md",
  ".kiro/steering/structure.md",
  ".kiro/steering/api.md",
  ".kiro/steering/ui.md",
  ".kiro/steering/kickoff.md",
  ".kiro/steering/ship.md",
  ".kiro/skills/change-topic/SKILL.md",
  ".kiro/skills/verify-mvp/SKILL.md",
  ".kiro/skills/prepare-submission/SKILL.md",
  "powers/hackathon-demo/skills/demo-check/SKILL.md",
];
const missingKiro = kiroFiles.filter((f) => !exists(f) || fs.statSync(path.join(ROOT, f)).size < 50);
add(missingKiro.length ? "FAIL" : "PASS", "Kiro 문서 파일", missingKiro.length ? `없음/비어 있음: ${missingKiro.join(", ")}` : `${kiroFiles.length}개 존재`);
const fmBad = kiroFiles
  .filter((f) => /\.kiro\/(steering|skills)|powers\//.test(f) && exists(f))
  .filter((f) => !fs.readFileSync(path.join(ROOT, f), "utf8").startsWith("---"));
add(fmBad.length ? "FAIL" : "PASS", "front matter", fmBad.length ? `첫 줄 --- 아님: ${fmBad.join(", ")}` : "steering·skills 모두 첫 줄 시작");

// kiro-cli 3.x는 .kiro/agents/*.json만 인식한다. Hook은 builder.json 안에 있다(.kiro/hooks/*.json은 CLI가 실행하지 않음).
for (const a of ["builder", "reviewer", "demo-editor"]) {
  const f = `.kiro/agents/${a}.json`;
  const r = kiroCli ? spawnSync(`kiro-cli agent validate --path ${f}`, { cwd: ROOT, shell: true, encoding: "utf8", windowsHide: true, timeout: 20_000 }) : null;
  add(!exists(f) ? "FAIL" : !r ? "WARN" : r.status === 0 ? "PASS" : "FAIL", f, !exists(f) ? "없음" : !r ? "kiro-cli 없음 — 검증 못함" : r.status === 0 ? "kiro-cli agent validate OK" : (r.stdout + r.stderr).trim().split(/\r?\n/).pop());
}

const jsonFiles = [
  ".kiro/settings/mcp.json",
  ".kiro/workflows/hackathon-investigate.workflow.json",
  ".kiro/workflows/hackathon-build.workflow.json",
  ".kiro/workflows/hackathon-demo.workflow.json",
  "powers/hackathon-demo/plugin.json",
];
for (const f of jsonFiles) {
  if (!exists(f)) {
    add("FAIL", f, "없음");
    continue;
  }
  try {
    JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
    add("PASS", f, "JSON 문법 OK (Kiro 인식·실행은 별도)");
  } catch (e) {
    add("FAIL", f, `JSON 오류: ${e.message}`);
  }
}

// --- 출력 ---
const w = Math.max(...rows.map((r) => r.item.length));
for (const r of rows) console.log(`${r.status.padEnd(4)}  ${r.item.padEnd(w)}  ${r.detail}`);
const fails = rows.filter((r) => r.status === "FAIL").length;
const warns = rows.filter((r) => r.status === "WARN").length;
console.log(`\n${rows.length - fails - warns} PASS · ${warns} WARN · ${fails} FAIL`);
process.exit(fails ? 1 : 0);
