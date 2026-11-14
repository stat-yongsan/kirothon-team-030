# Tasks (Quick Spec) — 잠자리채

> 완료 표시 규칙(AGENTS.md): `node scripts/quality.mjs task`가 PASS를 출력한 뒤에만 `[x]`.
> 시간 상자: 개발 종료 18:00 제출 기준.

- [x] 1. 도메인 계약·판정 로직 (R1, R3.5, R3.6, R3.9, R3.10, R4.1)
  - contracts / job / outputs / schedule / briefing / render / fixtures
  - 테스트: `contracts.test.ts`, `schedule.test.ts`, `outputs.test.ts`, `briefing.test.ts`
  - 검증: `node scripts/quality.mjs task`
- [x] 2. 영속 저장소·URL 수집기 (R2.2–R2.4, R5.3, R5.6)
  - store / fetch-url, 테스트 `store.test.ts`, `fetch-url.test.ts`
  - 검증: `node scripts/quality.mjs task`
- [x] 3. 생성 엔진 어댑터·워커 실행 (R2.3–R2.5, R3, R5.1, R5.2, R5.5)
  - kiro / prompts / youtube / worker / connections, 테스트 `worker.test.ts`(가짜 엔진)
  - 검증: `node scripts/quality.mjs task`
- [x] 4. 워커 프로세스 (R2.2, R2.8)
  - `scripts/jamjari-worker.ts`, `npm run worker`
  - 검증: 워커 실행 → 샘플 작업 1건 완료 → 강제 종료 후 재시작 시 재점유 기록 확인
- [x] 5. API·뷰어 (R1.3, R1.5, R2.1, R2.7, R4.4, R4.5, R5.4)
  - `/api/jamjari/jobs`, `/run`, `/jobs/[id]/answer`, `/jobs/[id]/cancel`, `/r/[id]`, `/p/[id]`, `/p/[id]/raw`
  - 테스트 `src/app/api/jamjari/api.test.ts` 20개: 헤더 없는 쓰기 403, 다른 Origin 403, 조합 거부 422, 담기 201·중복 200, 맡기기, 취소·409, 없는 ID·경로 조작 404, 답변 재큐, W2 링크 http/https만, 보고서·체험 CSP
  - 검증: `node scripts/quality.mjs task` PASS (13:19)
- [x] 6. 한 페이지 UI (R1.1–R1.2, R2.6, R2.8, R4.1–R4.6)
  - 담기 · 밤 작업 보드 · 아침 브리핑 · 연결 상태, 샘플 버튼, 1440/390px
  - 검증: 브라우저(Playwright Edge)로 샘플 흐름 1회
- [x] 7. 실제 연동 smoke (R3.1, R3.5, R3.6)
  - 워커 + kiro-cli로 W3 실제 1회(32초), W1 3회(59초·4분 7초·56초), W4 1회(32초). 결과 HTML·체험 URL 브라우저 확인(13:24–13:25)
  - 발견·수정: 웹 검색 신뢰 도구 이름(`remote_web_search`), 목록 상한 초과 invalid_output 1회
  - 실패·소요 시간 그대로 `docs/integration-status.md`에 기록. `quality.mjs task` PASS(13:26)
- [x] 8. 제출 문서 (Kiro 활용 증거)
  - `docs/integration-status.md`, `docs/skill-adapters.md`, `docs/evidence.md`(요구→코드→테스트→시연), `docs/DEMO.md`(3분 대본), README 앞부분·팀 섹션 갱신
  - 검증: `node scripts/quality.mjs release --force` PASS (13:34:17), `quality.mjs task` PASS
