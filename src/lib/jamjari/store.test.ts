import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { acknowledge, capture, deleteResults, entrust, answer, cancel, ServiceError } from "./service";
import { claimNext, getJob, listJobs, readArtifact, saveArtifact, updateJob } from "./store";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jamjari-store-"));
  process.env.JAMJARI_DATA_DIR = dir;
});
afterEach(() => {
  delete process.env.JAMJARI_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

const NOW = new Date("2026-11-14T14:30:00Z"); // 23:30 KST

describe("담기·맡기기 (R1.5, R2.1)", () => {
  it("담기는 draft로 저장, 입력 날짜는 KST", () => {
    const { job, created } = capture({ purpose: "idea", output: "html", text: "점심 메뉴", intent: "save", idempotencyKey: "click-0001" }, NOW);
    expect(created).toBe(true);
    expect(job.status).toBe("draft");
    expect(job.captureDate).toBe("2026-11-14");
    expect(getJob(job.id)?.input.text).toBe("점심 메뉴");
  });

  it("같은 클릭 키로 두 번 요청하면 새 작업을 만들지 않는다", () => {
    const a = capture({ purpose: "idea", output: "html", text: "x", intent: "save", idempotencyKey: "click-0002" }, NOW);
    const b = capture({ purpose: "idea", output: "html", text: "x", intent: "save", idempotencyKey: "click-0002" }, NOW);
    expect(b.created).toBe(false);
    expect(b.job.id).toBe(a.job.id);
    expect(listJobs()).toHaveLength(1);
  });

  it("서버도 잘못된 조합을 거부 (AC-01)", () => {
    expect(() => capture({ purpose: "summary", output: "html", text: "URL 없음", intent: "save" }, NOW)).toThrow(ServiceError);
    expect(listJobs()).toHaveLength(0);
  });

  it("맡기기는 draft만 queued로", () => {
    const a = capture({ purpose: "idea", output: "html", text: "a", intent: "save" }, NOW).job;
    const b = capture({ purpose: "idea", output: "html", text: "b", intent: "queue" }, NOW).job;
    expect(entrust(undefined, NOW)).toEqual([a.id]);
    expect(getJob(a.id)?.status).toBe("queued");
    expect(getJob(b.id)?.status).toBe("queued");
  });
});

describe("점유와 lease (R2.3, AC-03)", () => {
  it("queued를 점유하면 running·attempts 1·lease 기록, 두 번째 점유는 없음", () => {
    const j = capture({ purpose: "idea", output: "html", text: "a", intent: "queue" }, NOW).job;
    const c = claimNext("w1", 60_000, NOW);
    expect(c?.id).toBe(j.id);
    expect(c?.status).toBe("running");
    expect(c?.attempts).toBe(1);
    expect(c?.leaseUntil).toBe("2026-11-14T14:31:00.000Z");
    expect(claimNext("w2", 60_000, NOW)).toBeNull();
  });

  it("lease가 만료된 running은 다른 워커가 재점유", () => {
    const j = capture({ purpose: "idea", output: "html", text: "a", intent: "queue" }, NOW).job;
    claimNext("w1", 60_000, NOW);
    const later = new Date(NOW.getTime() + 61_000);
    const c = claimNext("w2", 60_000, later);
    expect(c?.id).toBe(j.id);
    expect(c?.attempts).toBe(2);
    expect(c?.history.at(-1)?.event).toContain("워커 중단 감지");
  });

  it("scheduled는 runAt 이후에만 점유", () => {
    const j = capture({ purpose: "idea", output: "html", text: "a", intent: "save" }, NOW).job;
    updateJob(j.id, (x) => {
      x.status = "scheduled";
      x.runAt = "2026-11-14T14:35:00.000Z";
    });
    expect(claimNext("w", 1000, NOW)).toBeNull();
    expect(claimNext("w", 1000, new Date("2026-11-14T14:35:01Z"))?.id).toBe(j.id);
  });
});

describe("답변·취소 (R2.7, R4.4)", () => {
  it("needs_input에 답하면 ingest만 남기고 다시 queued", () => {
    const j = capture({ purpose: "schedule", output: "calendar", text: "11월 20일 세미나", intent: "queue" }, NOW).job;
    updateJob(j.id, (x) => {
      x.status = "needs_input";
      x.question = { text: "연도는?", answer: null };
      x.checkpoint = { ingest: { fetched: null, notes: [] }, generate: { candidates: [] } };
      x.steps = { ingest: { status: "done", at: "t" }, generate: { status: "done", at: "t" } };
      x.attempts = 1;
    });
    const a = answer(j.id, "2026년", NOW);
    expect(a.status).toBe("queued");
    expect(a.question?.answer).toBe("2026년");
    expect(Object.keys(a.checkpoint)).toEqual(["ingest"]);
    expect(a.attempts).toBe(0);
  });

  it("답을 기다리지 않는 작업에는 409", () => {
    const j = capture({ purpose: "idea", output: "html", text: "a", intent: "save" }, NOW).job;
    expect(() => answer(j.id, "x", NOW)).toThrow(/답변을 기다리는/);
  });

  it("취소: draft → cancelled, 끝난 작업은 409", () => {
    const j = capture({ purpose: "idea", output: "html", text: "a", intent: "save" }, NOW).job;
    expect(cancel(j.id, NOW).status).toBe("cancelled");
    expect(() => cancel(j.id, NOW)).toThrow(/이미 끝난/);
  });

  it("없는 ID·경로 조작 ID는 404", () => {
    expect(() => cancel("../../etc", NOW)).toThrow(/찾을 수 없습니다/);
    expect(getJob("j_0000000000000000")).toBeNull();
  });
});

describe("전체 결과함 삭제", () => {
  function finished(text: string) {
    const { job } = capture({ purpose: "idea", output: "html", text, intent: "save" }, NOW);
    saveArtifact("a_0123456789abcdef", "<p>결과</p>", "html");
    updateJob(job.id, (j) => {
      j.status = "completed";
      j.result = { jobId: j.id, workflow: j.workflow, status: "completed", title: "t", highlights: [], artifactId: "a_0123456789abcdef", notionSyncStatus: "not_configured", assumptions: [], coverageNotes: [], sources: [], errors: [], engine: "code" };
    });
    return job.id;
  }

  it("확인완료한 작업만 삭제되고 결과 파일도 함께 지워진다. 확인 전 작업·없는 ID는 건너뛴다", () => {
    const acked = finished("확인한 결과");
    acknowledge(acked, NOW);
    const notAcked = capture({ purpose: "idea", output: "html", text: "확인 전", intent: "save" }, NOW).job.id;
    const out = deleteResults([acked, notAcked, "j_ffffffffffffffff"]);
    expect(out.deleted).toEqual([acked]);
    expect(out.skipped).toEqual([notAcked, "j_ffffffffffffffff"]);
    expect(getJob(acked)).toBeNull();
    expect(readArtifact("a_0123456789abcdef", "html")).toBeNull();
    expect(getJob(notAcked)).not.toBeNull();
  });
});
