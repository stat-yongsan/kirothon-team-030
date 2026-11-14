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
- [x] 9. 검수 대응: 미검증 경로 실제 확인과 결함 수정 (R2.1, R3.4, R3.7–R3.10, R4.4, R5.6) — 14:25–14:45
  - 실제 실행(kiro-cli, 샘플 아님): W1 화면 흐름(63초, 출처 8/8 응답, 웹 검색 3회), W2 1회(58초, 외부 조치 필요·영상 URL 없음), W6 모호 입력 → 질문·화면 답변 반복 → 외부 조치 필요, W5 오류 2종(64분 영상 too_long, 없는 영상 video_unavailable), "바로 정리" W3 1회(담기 1번 → 38초 완료)
  - 발견·수정: ① W6 연도 판정이 모델의 표시만 믿음 → 코드가 원문·답변에서 연도를 다시 확인(`verifyYearStated`, 방어 보강. 처음 의심한 '지어낸 답변'은 실제 사용자 답변이었음) ② 질문이 두 번 이어지면 앞선 답이 사라짐 → 답변 누적(`answers`) ③ 입력 단계 실패도 "kiro-cli 실제 생성" 배지 → `engine: code` ④ 다른 기기 접속 시 담기 403 → Host 헤더 비교(14:19)
  - 데모 요청 반영: "바로 정리" 체크(기본 켬)로 담자마자 큐에 넣어 워커가 즉시 처리. 끄면 기존처럼 저장 후 맡기기
  - 테스트 추가: W5 워커 경로 7개, W6 질문→답변→재개 2개, 연도 재확인 3개, Host 1개 → 총 125개
  - 검증: `node scripts/quality.mjs task` PASS, `release --force` PASS(14:38:50), Edge로 W1·W6 답변·바로 정리·사진 선택 확인
  - 미완(원래 목표 중 연결 필요): Notebook 영상 생성(W2), Google Calendar 실제 등록(W6), Notion 날짜별 기록, Google 로그인, 이미지 내용 분석, 정시 자동 실행
- [x] 10. 화면 개편·연결 상태 실확인·결과함 (17:00–17:25)
  - 홈 카드 4개, 확인완료 → 전체 결과함, 선택 삭제, 실제 호출 기반 연결 상태. 테스트 138개
  - 미완: Google 로그인(JWT)·사용자별 Notion/Calendar 연결은 사용자 지시로 중단(구현 없음)
  - 검증: `node scripts/quality.mjs task`
