// 로컬 영속 저장소: 작업별 JSON 파일 + 원자적 쓰기(임시 파일 → rename) + 작업별 잠금 파일.
// 웹 서버와 워커(별도 프로세스)가 같은 폴더를 쓴다. 새 DB 의존성 없이 브라우저를 닫아도 유지된다(AC-02).
// Vercel 서버리스의 임시 파일 시스템에서는 영속되지 않으므로 로컬·상시 서버 전용이다.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TERMINAL, type JobStatus } from "../../domain/jamjarichae/contracts.ts";
import type { Job } from "../../domain/jamjarichae/job.ts";

export const ID_RE = /^[a-z]_[0-9a-f]{16}$/;

export function dataDir(): string {
  return process.env.JAMJARI_DATA_DIR?.trim() || path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "jamjarichae");
}

const sub = (name: string) => path.join(dataDir(), name);

export function ensureDirs(): void {
  for (const d of ["jobs", "artifacts", "uploads", "locks", "sandbox"]) fs.mkdirSync(sub(d), { recursive: true });
}

export function newId(prefix: "j" | "a" | "u"): string {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function sleepSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function writeFileAtomic(file: string, content: string | Buffer): void {
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(tmp, content);
  for (let i = 0; ; i++) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (i >= 20 || (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES")) {
        fs.rmSync(tmp, { force: true });
        throw error;
      }
      sleepSync(25);
    }
  }
}

function readJsonFile<T>(file: string): T | null {
  for (let i = 0; i < 5; i++) {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8")) as T;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return null;
      sleepSync(20);
    }
  }
  return null;
}

const jobFile = (id: string) => {
  if (!ID_RE.test(id)) throw new Error("invalid id");
  return path.join(sub("jobs"), `${id}.json`);
};

const STALE_LOCK_MS = 30_000;

/** 작업 하나를 잠그고 fn을 실행한다. 다른 프로세스가 잡고 있으면 최대 waitMs 기다린다 */
export function withLock<T>(id: string, fn: () => T, waitMs = 3_000): T {
  if (!ID_RE.test(id)) throw new Error("invalid id");
  ensureDirs();
  const lock = path.join(sub("locks"), `${id}.lock`);
  const deadline = Date.now() + waitMs;
  for (;;) {
    try {
      const fd = fs.openSync(lock, "wx");
      fs.writeSync(fd, `${process.pid} ${new Date().toISOString()}`);
      fs.closeSync(fd);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > STALE_LOCK_MS) fs.rmSync(lock, { force: true });
      } catch {
        /* 다른 프로세스가 방금 해제 */
      }
      if (Date.now() > deadline) throw new Error("lock_timeout");
      sleepSync(30);
    }
  }
  try {
    return fn();
  } finally {
    fs.rmSync(lock, { force: true });
  }
}

export function getJob(id: string): Job | null {
  if (!ID_RE.test(id)) return null;
  return readJsonFile<Job>(jobFile(id));
}

export function listJobs(): Job[] {
  ensureDirs();
  const jobs: Job[] = [];
  for (const name of fs.readdirSync(sub("jobs"))) {
    if (!name.endsWith(".json")) continue;
    const job = readJsonFile<Job>(path.join(sub("jobs"), name));
    if (job) jobs.push(job);
  }
  return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 같은 idempotencyKey로 이미 만든 작업이 있으면 그것을 돌려준다(중복 클릭 방지) */
export function createJob(job: Job): { job: Job; created: boolean } {
  ensureDirs();
  const existing = listJobs().find((j) => j.idempotencyKey === job.idempotencyKey && j.userId === job.userId);
  if (existing) return { job: existing, created: false };
  writeFileAtomic(jobFile(job.id), JSON.stringify(job, null, 2));
  return { job, created: true };
}

export function saveJob(job: Job): void {
  job.updatedAt = new Date().toISOString();
  writeFileAtomic(jobFile(job.id), JSON.stringify(job, null, 2));
}

/** 잠금 아래에서 읽고 고쳐 쓴다. mutate가 false를 돌려주면 쓰지 않는다 */
export function updateJob(id: string, mutate: (job: Job) => boolean | void): Job | null {
  return withLock(id, () => {
    const job = getJob(id);
    if (!job) return null;
    if (mutate(job) === false) return job;
    saveJob(job);
    return job;
  });
}

export function pushHistory(job: Job, event: string, at = new Date()): void {
  job.history.push({ at: at.toISOString(), event });
  if (job.history.length > 100) job.history.splice(0, job.history.length - 100);
}

/**
 * 실행할 작업 하나를 점유한다: queued, 시각이 된 scheduled, lease가 만료된 running(워커 중단 복구, AC-03).
 * 점유하면 status=running, leaseUntil, workerId, attempts+1을 기록한다.
 */
export function claimNext(workerId: string, leaseMs: number, now = new Date()): Job | null {
  const candidates = listJobs()
    .filter((j) => isClaimable(j, now))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const c of candidates) {
    try {
      const claimed = withLock(
        c.id,
        () => {
          const job = getJob(c.id);
          if (!job || !isClaimable(job, now)) return null;
          const recovered = job.status === "running";
          job.status = "running";
          job.workerId = workerId;
          job.leaseUntil = new Date(now.getTime() + leaseMs).toISOString();
          job.attempts += 1;
          pushHistory(job, recovered ? `워커 중단 감지 → 체크포인트부터 재개(시도 ${job.attempts})` : `실행 시작(시도 ${job.attempts})`, now);
          saveJob(job);
          return job;
        },
        500,
      );
      if (claimed) return claimed;
    } catch {
      /* 다른 워커가 잠금 중 → 다음 후보 */
    }
  }
  return null;
}

export function isClaimable(job: Job, now: Date): boolean {
  if (job.status === "queued") return true;
  if (job.status === "scheduled") return !job.runAt || new Date(job.runAt).getTime() <= now.getTime();
  if (job.status === "running") return !job.leaseUntil || new Date(job.leaseUntil).getTime() < now.getTime();
  return false;
}

export function isTerminal(status: JobStatus): boolean {
  return TERMINAL.includes(status);
}

// ---- 결과물 ----

export function saveArtifact(id: string, content: string | Buffer, ext: "html" | "jpg" | "mp4"): void {
  ensureDirs();
  if (!ID_RE.test(id)) throw new Error("invalid id");
  writeFileAtomic(path.join(sub("artifacts"), `${id}.${ext}`), content);
}

export function readArtifact(id: string, ext: "html" | "jpg" | "mp4"): Buffer | null {
  if (!ID_RE.test(id)) return null;
  try {
    return fs.readFileSync(path.join(sub("artifacts"), `${id}.${ext}`));
  } catch {
    return null;
  }
}

export function saveUpload(id: string, ext: string, data: Buffer): string {
  ensureDirs();
  if (!ID_RE.test(id) || !/^(png|jpg|webp)$/.test(ext)) throw new Error("invalid upload");
  const key = `${id}.${ext}`;
  writeFileAtomic(path.join(sub("uploads"), key), data);
  return key;
}

/** 작업별 Kiro 실행 폴더(빈 폴더). 앱 소스·비밀값이 없는 곳에서 실행한다 */
export function sandboxFor(jobId: string): string {
  if (!ID_RE.test(jobId)) throw new Error("invalid id");
  const dir = path.join(sub("sandbox"), jobId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ---- 워커 심장박동 ----

export interface WorkerBeat {
  pid: number;
  workerId: string;
  beatAt: string;
  kiro: { ok: boolean; checkedAt: string; detail: string } | null;
  currentJobId: string | null;
}

export function writeBeat(beat: WorkerBeat): void {
  ensureDirs();
  writeFileAtomic(path.join(dataDir(), "worker.json"), JSON.stringify(beat, null, 2));
}

export function readBeat(): WorkerBeat | null {
  return readJsonFile<WorkerBeat>(path.join(dataDir(), "worker.json"));
}
