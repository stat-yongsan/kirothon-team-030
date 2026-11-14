// 잠자리채 야간 워커. 웹 서버와 별개 프로세스로 실행한다: npm.cmd run worker
// - 3초마다 큐에서 작업 1개를 점유(lease 60초, 심장박동으로 연장)하고 실행한다. 동시 실행 1개.
// - 5초마다 심장박동(worker.json)과 실행 중 작업의 lease를 갱신한다.
// - Ctrl+C로 끄면 실행 중 작업은 lease 만료 후 다음 워커가 체크포인트부터 이어간다.
import crypto from "node:crypto";
import { checkKiroInstalled, runKiro } from "../src/lib/jamjari/kiro.ts";
import { claimNext, ensureDirs, updateJob, writeBeat } from "../src/lib/jamjari/store.ts";
import { defaultDeps, processJob } from "../src/lib/jamjari/worker.ts";

const workerId = `w_${crypto.randomBytes(4).toString("hex")}`;
const deps = defaultDeps(runKiro);
const POLL_MS = 3_000;
const BEAT_MS = 5_000;

let current: string | null = null;
let stopping = false;

ensureDirs();
const kiroCheck = checkKiroInstalled();
const kiro = { ok: kiroCheck.ok, detail: kiroCheck.detail, checkedAt: new Date().toISOString() };
console.log(`[worker] ${workerId} 시작 pid=${process.pid} kiro-cli=${kiro.ok ? kiro.detail : `없음(${kiro.detail})`}`);

function beat() {
  writeBeat({ pid: process.pid, workerId, beatAt: new Date().toISOString(), kiro, currentJobId: current });
  if (current) {
    const id = current;
    try {
      updateJob(id, (j) => {
        if (j.status !== "running" || j.workerId !== workerId) return false;
        j.leaseUntil = new Date(Date.now() + deps.leaseMs).toISOString();
      });
    } catch {
      /* 잠금 경합: 다음 박동에서 갱신 */
    }
  }
}

const beatTimer = setInterval(beat, BEAT_MS);
beat();

async function loop() {
  while (!stopping) {
    let job = null;
    try {
      job = claimNext(workerId, deps.leaseMs);
    } catch (e) {
      console.error(`[worker] 점유 오류: ${(e as Error).message}`);
    }
    if (!job) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      continue;
    }
    current = job.id;
    beat();
    const started = Date.now();
    console.log(`[worker] ${job.id} ${job.workflow} 시작(시도 ${job.attempts}${job.sample ? ", 샘플" : ""})`);
    const status = await processJob(job.id, deps);
    console.log(`[worker] ${job.id} → ${status} (${Math.round((Date.now() - started) / 1000)}초)`);
    current = null;
    beat();
  }
}

function shutdown(signal: string) {
  if (stopping) process.exit(1);
  stopping = true;
  console.log(`[worker] ${signal}: 종료합니다${current ? ` — 실행 중 ${current}은(는) lease 만료 후 재개됩니다` : ""}.`);
  clearInterval(beatTimer);
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

loop().catch((e) => {
  console.error(`[worker] 중단: ${(e as Error).message}`);
  process.exit(1);
});
