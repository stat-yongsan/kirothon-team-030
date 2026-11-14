#!/usr/bin/env node
// 품질 검사 러너. 모델을 호출하지 않는 셸 검사만 수행한다.
//
//   node scripts/quality.mjs save [--file <path>]   변경된 src 파일만 ESLint (가벼운 검사 1개)
//   node scripts/quality.mjs task                   typegen + TypeScript + 핵심 테스트
//   node scripts/quality.mjs release [--force]      lint + 타입 + 테스트 + build (--timeout <초>: 단계별 상한 덮어쓰기)
//   node scripts/quality.mjs reset-status           .kiro/runs/build-status.json 초기화(워크플로 시작 시)
//   node scripts/quality.mjs verify-status          build-status.json이 현재 소스와 일치하는지 확인
//
// 종료 코드: 0 통과 / 1 검사 실패 / 3 다른 검사 실행 중(통과 아님) / 4 도구·테스트 없음 / 5 시간 초과 / 64 사용법 오류
// Kiro Hook이 stdin으로 JSON(hook_event_name, file_path, spec_name, task_name, task_success …)을 주면 읽는다.
// 파일명은 셸 문자열에 붙이지 않고 인자 배열로 전달한다. 로그·캐시는 .kiro/runs/ (gitignore)에 쓴다.

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Windows에서 드라이브 문자 대소문자가 다르면(d:\ vs D:\) Vitest 모듈이 두 번 로드되어 실패하므로 대문자로 통일한다.
const ROOT = path
  .resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  .replace(/^[a-z]:/, (d) => d.toUpperCase());
const RUN_DIR = path.join(ROOT, ".kiro", "runs");
const Q_DIR = path.join(RUN_DIR, "quality");
const STATUS_FILE = path.join(RUN_DIR, "build-status.json");
const LOCK_FILE = path.join(Q_DIR, "quality.lock");
const CACHE_FILE = path.join(Q_DIR, "cache.json");
const BASELINE_FILE = path.join(Q_DIR, "save-baseline.json");

const EXIT = { PASS: 0, FAIL: 1, BUSY: 3, SETUP: 4, TIMEOUT: 5, USAGE: 64 };
const TOOLS = {
  eslint: "node_modules/eslint/bin/eslint.js",
  tsc: "node_modules/typescript/bin/tsc",
  vitest: "node_modules/vitest/vitest.mjs",
  next: "node_modules/next/dist/bin/next",
};
const CONFIG_FILES = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "eslint.config.mjs",
  "next.config.ts",
  "vitest.config.mts",
];
// 모드별 lock 대기 상한(초). 대기 + 검사 시간이 Hook timeout(save 45초, task 120초)을 넘지 않게 둔다.
const LOCK_WAIT = { save: 5, task: 30, release: 120 };
// ESLint 자체 캐시(소스 밖, gitignore된 .kiro/runs/)로 반복 실행 시간을 줄인다.
const ESLINT_CACHE = ["--cache", "--cache-location", ".kiro/runs/quality/eslintcache"];

// ---------- 인자 ----------
const [mode, ...rest] = process.argv.slice(2);
// --timeout <초>: 모든 단계의 시간 상한을 덮어쓴다(느린 PC 또는 timeout 동작 확인용)
const flags = { force: rest.includes("--force"), file: argValue("--file"), timeout: Number(argValue("--timeout")) || null };
function argValue(name) {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
}

// ---------- 공용 ----------
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sha(data) {
  return createHash("sha256").update(data).digest("hex");
}

function walk(dir, filter, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, filter, out);
    else if (filter(p)) out.push(p);
  }
  return out.sort();
}

const isSource = (p) => /\.(ts|tsx|css|mjs)$/.test(p);
const sourceFiles = () => [
  ...walk(path.join(ROOT, "src"), isSource),
  ...walk(path.join(ROOT, "scripts"), isSource),
];

function hashFiles(files) {
  const h = createHash("sha256");
  h.update(`node ${process.version}\n`);
  for (const f of files) {
    h.update(rel(f) + "\0");
    h.update(fs.existsSync(f) ? fs.readFileSync(f) : "<missing>");
    h.update("\0");
  }
  return h.digest("hex");
}

/** 현재 소스 + 설정 + 의존성 잠금 파일의 해시. 바뀌면 캐시는 자동 무효화된다. */
function projectHash() {
  return hashFiles([...sourceFiles(), ...CONFIG_FILES.map((f) => path.join(ROOT, f))]);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

/** Windows 백신·인덱서가 잠근 파일(EBUSY/EPERM)에 대비해 캐시 쓰기만 최대 3회 재시도 */
async function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let attempt = 1; ; attempt++) {
    try {
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
      fs.renameSync(tmp, file);
      return;
    } catch (e) {
      if (attempt >= 3 || !["EBUSY", "EPERM", "EACCES"].includes(e.code)) throw e;
      await sleep(150 * attempt);
    }
  }
}

async function readHookPayload() {
  if (process.stdin.isTTY) return null;
  const chunks = [];
  const done = new Promise((resolve) => {
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", resolve);
    process.stdin.on("error", resolve);
  });
  await Promise.race([done, sleep(1000)]);
  process.stdin.pause();
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ---------- lock ----------
function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}

async function acquireLock(waitSeconds) {
  fs.mkdirSync(Q_DIR, { recursive: true });
  const deadline = Date.now() + waitSeconds * 1000;
  for (;;) {
    try {
      const fd = fs.openSync(LOCK_FILE, "wx");
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, mode, at: new Date().toISOString() }));
      fs.closeSync(fd);
      return true;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      const holder = readJson(LOCK_FILE, null);
      const age = holder ? Date.now() - Date.parse(holder.at) : Infinity;
      if (!holder || !pidAlive(holder.pid) || age > 15 * 60_000) {
        fs.rmSync(LOCK_FILE, { force: true }); // 비정상 종료로 남은 lock
        continue;
      }
      if (Date.now() >= deadline) return false;
      await sleep(250);
    }
  }
}

const releaseLock = () => {
  const holder = readJson(LOCK_FILE, null);
  if (holder?.pid === process.pid) fs.rmSync(LOCK_FILE, { force: true });
};

// ---------- 실행 ----------
function killTree(child) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
  } else {
    child.kill("SIGKILL");
  }
}

function runTool(name, tool, args, timeoutSeconds) {
  const toolPath = path.join(ROOT, TOOLS[tool]);
  if (!fs.existsSync(toolPath)) {
    return Promise.resolve({ name, status: "TOOL_MISSING", exitCode: null, ms: 0, output: `${TOOLS[tool]} 없음 — npm.cmd install 필요` });
  }
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [toolPath, ...args], {
      cwd: ROOT,
      windowsHide: true,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", NEXT_TELEMETRY_DISABLED: "1" },
    });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutSeconds * 1000);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ name, status: timedOut ? "TIMEOUT" : code === 0 ? "PASS" : "FAIL", exitCode: code, ms: Date.now() - started, output });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ name, status: "FAIL", exitCode: null, ms: Date.now() - started, output: String(err) });
    });
  });
}

const FAIL_KIND = { lint: "LINT_FAIL", typegen: "TYPE_ERROR", typecheck: "TYPE_ERROR", test: "TEST_FAIL", build: "BUILD_FAIL" };

async function runSteps(steps) {
  const results = [];
  for (const s of steps) {
    const r = await runTool(s.name, s.tool, s.args, flags.timeout ?? s.timeout);
    if (r.status === "FAIL") r.status = FAIL_KIND[s.name] ?? "FAIL";
    results.push(r);
    if (r.status !== "PASS") break; // 첫 실패에서 멈춘다(원인 하나를 짧게 보고)
  }
  return results;
}

function exitFor(results) {
  const bad = results.find((r) => r.status !== "PASS");
  if (!bad) return EXIT.PASS;
  if (bad.status === "TIMEOUT") return EXIT.TIMEOUT;
  if (bad.status === "TOOL_MISSING" || bad.status === "NO_TESTS") return EXIT.SETUP;
  return EXIT.FAIL;
}

// ---------- 모드 ----------
async function changedSourceTargets(payload) {
  // kiro-cli PostToolUse(write)는 tool_input.path로 파일을 준다.
  const explicit = flags.file ?? payload?.file_path ?? payload?.tool_input?.path;
  if (explicit) {
    const abs = path.resolve(ROOT, explicit);
    const r = rel(abs);
    if (/^src\/.*\.(ts|tsx)$/.test(r) && fs.existsSync(abs)) return { files: [abs], reason: `hook/인자 파일 ${r}` };
    if (r.startsWith("src/") && !fs.existsSync(abs)) return { files: [], reason: `삭제된 파일 ${r}` };
    // src 밖이거나 대상 확장자가 아니면 변경 해시로 판단한다.
  }
  const baseline = readJson(BASELINE_FILE, {});
  const candidates = walk(path.join(ROOT, "src"), (p) => /\.(ts|tsx)$/.test(p));
  const changed = candidates.filter((f) => baseline[rel(f)] !== sha(fs.readFileSync(f)));
  return { files: changed, reason: "마지막 통과 이후 변경 파일" };
}

async function modeSave(payload) {
  await sleep(300); // 연속 저장을 한 번으로 묶는 debounce
  const { files, reason } = await changedSourceTargets(payload);
  if (files.length === 0) {
    return { results: [], note: `검사 대상 없음 (${reason}) — 마지막 통과 기준과 동일`, exit: EXIT.PASS, cacheable: false };
  }
  const targets = files.length > 30 ? [path.join(ROOT, "src")] : files;
  const key = `save:${hashFiles([...files, path.join(ROOT, "eslint.config.mjs"), path.join(ROOT, "package-lock.json")])}`;
  return {
    key,
    files,
    steps: [{ name: "lint", tool: "eslint", args: [...ESLINT_CACHE, "--max-warnings=0", "--no-warn-ignored", "--", ...targets.map(rel)], timeout: 38 }],
    note: `${reason}: ${files.length > 5 ? `${files.length}개` : files.map(rel).join(", ")}`,
  };
}

function testFilesExist() {
  return walk(path.join(ROOT, "src"), (p) => /\.test\.tsx?$/.test(p)).length > 0;
}

function modeTask() {
  return {
    key: `task:${projectHash()}`,
    steps: [
      { name: "typegen", tool: "next", args: ["typegen"], timeout: 30 },
      { name: "typecheck", tool: "tsc", args: ["--noEmit", "--pretty", "false"], timeout: 50 },
      { name: "test", tool: "vitest", args: ["run"], timeout: 35 },
    ],
  };
}

function modeRelease() {
  return {
    key: `release:${projectHash()}`,
    steps: [
      { name: "lint", tool: "eslint", args: [...ESLINT_CACHE, "--max-warnings=0"], timeout: 120 },
      { name: "typegen", tool: "next", args: ["typegen"], timeout: 60 },
      { name: "typecheck", tool: "tsc", args: ["--noEmit", "--pretty", "false"], timeout: 120 },
      { name: "test", tool: "vitest", args: ["run"], timeout: 180 },
      { name: "build", tool: "next", args: ["build"], timeout: 420 },
    ],
  };
}

async function writeBuildStatus(complete, extra) {
  await writeJson(STATUS_FILE, {
    complete,
    writer: "scripts/quality.mjs",
    sourceHash: projectHash(),
    checkedAt: new Date().toISOString(),
    ...extra,
  });
}

function report(label, results, note, cached) {
  const summary = results.map((r) => `${r.name}:${r.status}(${(r.ms / 1000).toFixed(1)}s)`).join(" ");
  const bad = results.find((r) => r.status !== "PASS");
  const head = bad ? `FAIL ${bad.status}` : cached ? "PASS (cached)" : "PASS";
  console.log(`[quality:${label}] ${head}${summary ? ` — ${summary}` : ""}`);
  if (note) console.log(`  ${note}`);
  if (bad) {
    const lines = bad.output.trim().split(/\r?\n/).filter(Boolean);
    console.log(`  --- ${bad.name} 출력 마지막 ${Math.min(25, lines.length)}줄 ---`);
    for (const l of lines.slice(-25)) console.log(`  ${l}`);
    console.log(`  전체 로그: ${rel(path.join(Q_DIR, `last-${label}.log`))}`);
  }
}

async function main() {
  if (mode === "reset-status") {
    await writeJson(STATUS_FILE, { complete: false, writer: "scripts/quality.mjs", reset: true, checkedAt: new Date().toISOString() });
    console.log("[quality] build-status.json 초기화: complete=false");
    return EXIT.PASS;
  }
  if (mode === "verify-status") {
    const s = readJson(STATUS_FILE, null);
    if (!s) {
      console.log("[quality] build-status.json 없음");
      return EXIT.FAIL;
    }
    const current = projectHash();
    const ok = s.complete === true && s.writer === "scripts/quality.mjs" && s.sourceHash === current;
    console.log(
      ok
        ? `[quality] 상태 일치: complete=true, ${s.checkedAt} 검사 결과가 현재 소스와 같음`
        : `[quality] 상태 불일치: complete=${s.complete}, 해시 ${s.sourceHash === current ? "일치" : "불일치(검사 후 소스가 바뀜 또는 수동 기록)"} → node scripts/quality.mjs task 재실행`,
    );
    return ok ? EXIT.PASS : EXIT.FAIL;
  }
  if (!["save", "task", "release"].includes(mode)) {
    console.log("사용법: node scripts/quality.mjs <save|task|release|reset-status|verify-status> [--force] [--file <path>]");
    return EXIT.USAGE;
  }

  const payload = await readHookPayload();
  const hookNote = payload?.hook_event_name
    ? `Kiro ${payload.hook_event_name}${payload.task_name ? ` · ${payload.spec_name ?? ""}/${payload.task_name}` : ""}${payload.task_success === false ? " · Kiro가 작업 실패로 보고" : ""}`
    : "";

  if (!(await acquireLock(LOCK_WAIT[mode]))) {
    const holder = readJson(LOCK_FILE, {});
    console.log(`[quality:${mode}] BUSY — 다른 검사(${holder.mode ?? "?"}, pid ${holder.pid ?? "?"})가 실행 중이라 이번 검사는 실행하지 않음. 통과가 아님 — 끝난 뒤 다시 실행하세요.`);
    await writeJson(path.join(Q_DIR, `last-${mode}.json`), { mode, status: "BUSY", at: new Date().toISOString() });
    return EXIT.BUSY;
  }

  try {
    if ((mode === "task" || mode === "release") && !testFilesExist()) {
      const results = [{ name: "test", status: "NO_TESTS", ms: 0, output: "src/**/*.test.ts 없음 — 빈 테스트로 성공 처리하지 않음" }];
      report(mode, results, hookNote);
      if (mode === "task") await writeBuildStatus(false, { mode, steps: results.map(({ name, status }) => ({ name, status })) });
      return EXIT.SETUP;
    }

    const plan = mode === "save" ? await modeSave(payload) : mode === "task" ? modeTask() : modeRelease();
    if (!plan.steps) {
      report(mode, [], [hookNote, plan.note].filter(Boolean).join(" · "));
      return plan.exit;
    }

    const cache = readJson(CACHE_FILE, {});
    const cachedHit = !flags.force && cache[plan.key];
    let results;
    if (cachedHit) {
      results = cachedHit.steps.map((s) => ({ ...s, output: "" }));
    } else {
      results = await runSteps(plan.steps);
      const log = results.map((r) => `### ${r.name} → ${r.status} (exit ${r.exitCode}, ${r.ms}ms)\n${r.output}`).join("\n\n");
      fs.writeFileSync(path.join(Q_DIR, `last-${mode}.log`), log);
    }

    const exit = exitFor(results);
    const steps = results.map(({ name, status, ms }) => ({ name, status, ms }));
    if (exit === EXIT.PASS && !cachedHit) {
      // 성공한 동일 입력만 캐시한다. 키는 실행 시작 시점의 해시이므로 실행 중 바뀐 내용은 다음 실행에서 다시 검사된다.
      const entries = Object.entries({ ...cache, [plan.key]: { at: new Date().toISOString(), steps } }).slice(-40);
      await writeJson(CACHE_FILE, Object.fromEntries(entries));
    }
    if (exit === EXIT.PASS && mode === "save") {
      // 캐시 적중도 같은 내용의 통과이므로 기준선을 갱신한다.
      const baseline = readJson(BASELINE_FILE, {});
      for (const f of plan.files) if (fs.existsSync(f)) baseline[rel(f)] = sha(fs.readFileSync(f));
      await writeJson(BASELINE_FILE, baseline);
    }
    if (mode === "task" || mode === "release") {
      await writeBuildStatus(exit === EXIT.PASS, { mode, cached: Boolean(cachedHit), steps });
    }
    await writeJson(path.join(Q_DIR, `last-${mode}.json`), {
      mode,
      status: exit === EXIT.PASS ? (cachedHit ? "PASS_CACHED" : "PASS") : results.find((r) => r.status !== "PASS")?.status,
      exit,
      steps,
      at: new Date().toISOString(),
    });
    report(mode, results, [hookNote, plan.note].filter(Boolean).join(" · "), Boolean(cachedHit));
    return exit;
  } finally {
    releaseLock();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    releaseLock();
    console.error(`[quality] 내부 오류: ${err?.message ?? err}`);
    process.exit(EXIT.FAIL);
  },
);
