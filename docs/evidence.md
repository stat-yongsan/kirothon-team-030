# 근거 대응표 — 요구 → 코드 → 테스트 → 시연

> 기록 2026-11-14 13:34 KST. 요구 번호는 `.kiro/specs/jamjarichae/requirements.md`. 테스트는 `npm.cmd run test`(Vitest), 시연 시각은 `docs/DEMO.md`.
> 아래 대응표와 검사 기록은 14:48까지의 기록이다. 이후 W2 영상 생성, Calendar·Notion 실연동과 화면 개편은 [실행 기록](integration-status.md) 6·8절을 참고한다.
> "실측"은 이 PC에서 실제로 실행해 확인한 것, "테스트만"은 자동 테스트로만 확인한 것, "미검증"은 확인하지 않은 것이다.

## 1. 대응표

| 요구 | 코드 | 테스트 | 실측 / 시연 |
|---|---|---|---|
| R1.1–R1.2 목적 4개·결과 형태 | `src/domain/jamjarichae/contracts.ts` `WORKFLOWS`, `outputsFor` | `contracts.test.ts` "목적별 결과 형태" | 화면 4개 목적·결과 형태 표시 (DEMO 0:20) |
| R1.3 조합 검증(화면·서버 같은 규칙) | `contracts.ts` `validateCapture` ← `JamjariApp.tsx`, `service.ts` `capture` | `contracts.test.ts` 6경로 허용/거부, `store.test.ts` "서버도 잘못된 조합을 거부", `api.test.ts` 422 5종 | 실측 13:31: 안내 2줄 + 담기 버튼 잠김 (DEMO 0:20) |
| R1.4 입력 상한 | `contracts.ts` `LIMITS`, `src/lib/jamjari/http.ts` `sniffImage` | `contracts.test.ts` "http/https 이외 URL·큰 이미지…", "메모 5,000자 초과", `api.test.ts` "PNG가 아닌 내용…" | 테스트만 |
| R1.5 draft 저장·같은 클릭 키 중복 방지 | `service.ts` `capture`, `store.ts` `createJob` | `store.test.ts`, `api.test.ts` "담기 201, 같은 클릭 키 200·같은 작업" | 테스트만 |
| R1.6 KST 입력 날짜 | `contracts.ts` `captureDate` | `contracts.test.ts` 14:59Z/15:00Z 경계 | 테스트만 |
| R2.1 맡기기 draft → queued, 바로 정리 | `service.ts` `entrust`·`capture`(intent queue), `run/route.ts`, `JamjariApp.tsx` "바로 정리" | `store.test.ts` "맡기기는 draft만 queued로", `api.test.ts` | 실측 13:31 맡기기 (1) → 완료. 14:26 W1 화면 입력 → 맡기기 → 63초 완료. 14:43 "바로 정리"(데모 기본값) 담기 1번 → 38초 완료 |
| R2.2 별도 워커 프로세스 | `scripts/jamjari-worker.ts`, `npm.cmd run worker` | — | 실측: 워커 pid 32136, 화면 "야간 워커 연결됨" |
| R2.3–R2.4 lease·체크포인트 재개 | `store.ts` `claimNext`, `worker.ts` `step` | `store.test.ts` "lease가 만료된 running은 다른 워커가 재점유", `worker.test.ts` "generate가 끝난 뒤 워커가 죽으면 재점유 시 엔진을 다시 부르지 않는다" | 실측 13:05–13:09 `j_ffefff1abb396176`: 강제 종료 → 시도 2 재개, ingest 재실행 없음 (`integration-status.md` 4절) |
| R2.5 재시도(최대 3회, 백오프) | `worker.ts` `processJob` catch | `worker.test.ts` "JSON이 없으면 재시도 예약…", "형식 오류는 어긴 필드 경로를…" | 실측: invalid_output 1회 → 60초 뒤 시도 3 완료 |
| R2.6 상태 문구·진행률 없음 | `job.ts` `toView`, `JamjariApp.tsx` | — | 실측: 보드 카드 "완료 · 시도 N" |
| R2.7 취소 | `service.ts` `cancel`, `jobs/[id]/cancel/route.ts` | `store.test.ts`, `api.test.ts` "실행 전 작업 취소…" | 테스트만 |
| R2.8 워커 심장박동·꺼짐 표시 | `store.ts` `writeBeat`/`readBeat`, `connections.ts` | — | 실측: "실행 중(pid 32136, 마지막 신호 …)". 워커를 끈 상태의 "워커 꺼짐" 표시는 이번 세션에서 확인하지 않음 |
| R3.1–R3.2 W1 실제 검색·출처 응답 확인 | `worker.ts` `research`, `kiro.ts` `WEB_TOOLS`, `fetch-url.ts` `probeUrl` | `worker.test.ts` "정상: 웹 도구만 신뢰, 출처 응답 확인", "응답하는 출처가 없으면 partial" | 실측 13:22 `j_c11cae908b2ee864`: 검색 3회·출처 6/6 응답 (DEMO 1:05). 13:21 이전 W1 2건은 검색이 거부돼 web_fetch만 사용(수정함) |
| R3.3 모호하면 질문 | `worker.ts` `runConcept` | `worker.test.ts` "핵심 의미를 정할 수 없으면 질문으로 멈춤" | 테스트만 |
| R3.4 W2 영상 링크 만들지 않음 | `worker.ts` `runConcept`(W2 분기) | `worker.test.ts` "자료까지 만들고 외부 조치 대기, 영상 URL 없음" | 실측 14:27 `j_eaf747db4ece89fb` 58초: 조사 HTML, 출처 8/8, `awaiting_external_action`, 영상 URL 없음. 영상 자체는 만들지 않음 |
| R3.5 W3 5개·코드 검사 | `outputs.ts` `checkIdeas`, `prompts.ts` `ideaPrompt` | `outputs.test.ts`, `worker.test.ts` W3 2개 | 실측 12:56 `j_5e1a77d30c320de3` 32초 통과 (DEMO 1:35) |
| R3.6 W4 체험 안전 검사·격리 | `outputs.ts` `checkPrototypeHtml`, `src/app/p/[id]/route.ts`, `p/[id]/raw/route.ts` | `outputs.test.ts` 차단 5종, `worker.test.ts` W4 2개, `api.test.ts` CSP·sandbox | 실측 13:24: 버튼 클릭 화면 변화, iframe 쿠키 SecurityError (DEMO 1:55) |
| R3.7–R3.8 W5 웹·유튜브 | `worker.ts` `runSummary`, `youtube.ts`, `fetch-url.ts` | `fetch-url.test.ts`(SSRF 차단), `worker.test.ts` W5 7개(웹 완료·읽기 실패, 유튜브 partial·프레임 0장·too_long·no_transcript·video_unavailable, 14:25 추가) | 실측 13:40 웹 `j_3eb9d54aa7b198eb` 17초 completed(본문 6,359자). 13:45 유튜브 `j_c173998ada19c72b` 31초 partial(자막 6줄 + 실제 프레임 6장, Edge로 이미지·시점 링크 확인). 13:42 첫 유튜브 실행은 프레임 0장 → 포맷 선택식 수정(`integration-status.md` 3.3절). 14:29 오류 실측: 64분 영상 `too_long`, 없는 영상 `video_unavailable`(둘 다 엔진 호출 없음). 자막 없음은 테스트만 |
| R3.9–R3.10 W6 일정 판정·알림·URL 없음 | `schedule.ts` `decideSchedule`, `worker.ts` `runSchedule` | `schedule.test.ts` 14개, `worker.test.ts` W6 | 실측 13:47 `j_b15b2e4a438dd7c6` 10초: 행사·신청 마감 구분, 알림 2개, `awaiting_external_action`, URL 0개. 14:28–14:40 `j_496f010939296533`: 모호 입력 → 질문 → 화면 답변 → 재개 → 외부 조치 필요(실측). 답이 사라지던 결함 수정(3.6절), 연도 재확인 보강(`verifyYearStated`) |
| R3.11 결과 필드·가짜 URL 금지 | `job.ts` `Result`, `worker.ts` `baseResult` | `worker.test.ts` W2·W6 "URL 없음" | 실측: 보고서에 분석 범위·가정·출처 표시 |
| R3.12 Notion 별도 단계 | `worker.ts` `syncNotion` | `worker.test.ts`(결과 `not_configured`) | 실측: 모든 결과 `not_configured` |
| R4.1–R4.2 브리핑 집계·상위 3개 | `briefing.ts` `buildBriefing` | `briefing.test.ts` 3개 | 실측 13:31 "맡긴 9개 중 완료 8, 외부 조치 필요 1" (DEMO 1:05) |
| R4.3 HTML 열기·내려받기 | `src/app/r/[id]/route.ts` | `api.test.ts` "download=1이면 attachment" | 다운로드는 이전 세션 확인 |
| R4.4 답변 후 재큐 | `service.ts` `answer`, `job.ts` `answers` | `store.test.ts`, `api.test.ts`, `worker.test.ts` W6 질문 흐름 2개 | 실측 14:33–14:40 화면 답변 5번(W6) |
| R4.5 W2 링크 http/https만 | `service.ts` `answer` | `api.test.ts` "W2 외부 조치 링크는 http/https만" | 테스트만 |
| R4.6 연결 상태 따로 표시 | `connections.ts` `listConnections` | — | 실측 13:30: 6줄, 미연결 4·API 미지원 1 (DEMO 2:15) |
| R5.1 데이터 블록·고정 신뢰 도구 | `prompts.ts` `GUARD`·`inputBlock`, `kiro.ts` `kiroArgs` | `worker.test.ts` "도구 신뢰 없음 + 입력은 데이터 블록 안" | 실측: 세션 로그에서 신뢰 도구만 승인됨 |
| R5.2 빈 폴더·stdin | `kiro.ts` `runKiro`, `store.ts` `sandboxFor` | — | 실측: `.data/jamjarichae/sandbox/{jobId}`에서 실행 |
| R5.3 URL 수집기 SSRF 차단 | `fetch-url.ts` | `fetch-url.test.ts` 19개 | 테스트만 |
| R5.4 신뢰 템플릿·스크립트 불허 CSP | `render.ts`, `r/[id]/route.ts` | `api.test.ts` CSP | 실측 13:25: 보고서 스크립트 0개, CSP 헤더 |
| R5.5 샘플 모드 외부 호출 없음 | `worker.ts` `sampleOr` | `worker.test.ts` "샘플 모드는 엔진·URL 호출 없이 샘플 표시" | 실측: 샘플 카드 "샘플 결과" 배지 |
| R5.6 ID 검사·404 | `store.ts` `ID_RE`, `service.ts` `mustGet` | `store.test.ts`, `api.test.ts` "없는 ID·경로 조작 ID는 404" | 테스트만 |
| 쓰기 요청 가드(설계) | `http.ts` `guard` | `api.test.ts` 헤더 없음 403, 다른 Origin 403, 바인딩 주소(0.0.0.0)여도 Origin=Host면 통과 | 실측 14:20: 휴대폰 접속용 `next start -H 0.0.0.0`(LAN IP)에서 같은 Origin 200, 다른 Origin 403. 수정 전에는 같은 화면의 담기도 403(`integration-status.md` 3.4절) |

## 2. Kiro 활용 증거 (실제 기록만)

| 항목 | 증거 |
|---|---|
| 설정만 한 것(오늘 미사용) | `.kiro/agents/builder·reviewer·demo-editor`와 builder의 Hook(저장·턴 종료 시 `quality.mjs`)은 설정돼 있지만 오늘 개발 세션 3개는 기본 에이전트로 진행됐다(세션 메타데이터에 에이전트 이름 없음). 검사는 같은 명령을 직접 실행했다 |
| kiro-cli 개발 세션 | `sess_4f861dd9-…`(11:04–13:10 KST, 모델 `claude-opus-5.5`, effort `xhigh`, specWorkflow `quick`), 이어서 `sess_b4b2809d-…`(13:11–). 세션 메타데이터 `~/.kiro/sessions/90aa50a40ee50e6b/*/session.json` |
| Spec | `.kiro/specs/jamjarichae/requirements.md` → `design.md` → `tasks.md`. 작업 8개 중 체크는 `node scripts/quality.mjs task` PASS 뒤에만 |
| Steering | `.kiro/steering/`(product·structure·tech·ui)와 `AGENTS.md`. 14:05 연습 템플릿 정리 때 잠자리채 기준으로 고침 |
| Agents | `.kiro/agents/builder.json`, `reviewer.json`, `demo-editor.json` |
| MCP | `.kiro/settings/mcp.json`의 Playwright MCP(Edge)로 화면·체험 페이지·CSP 확인 |
| 런타임 엔진 | 앱이 작업마다 `kiro-cli chat --v3 --no-interactive`를 실행. 14:45 기준 저장소의 실제(비샘플) 작업 21건(W1 4·W2 1·W3 3·W4 3·W5 7·W6 3, 사용자 테스트 포함). 결과: 완료 11, 부분 완료 2, 외부 조치 필요 3, 내 답변 필요 1, 실패 4(W5 오류 확인 2건 포함) |
| 검사 기록 | `.kiro/runs/quality/last-task.json`, `last-release.json`(`scripts/quality.mjs`만 씀) |
| 실행 중 디버깅 | kiro-cli 세션 로그(`messages.jsonl`)로 웹 검색 거부와 invalid_output 원인을 찾아 수정(`integration-status.md` 3절) |

## 3. 검사 결과

- `node scripts/quality.mjs task`: PASS(13:26)
- 테스트: 125개 통과(파일 8개): domain 51, lib 53, api 21. 14:18 Host 회귀 1개, 14:25–14:37 W5 워커 7개·W6 질문 흐름 2개·연도 재확인 3개 추가. 14:05에 연습 템플릿 테스트 55개(파일 6개)를 코드와 함께 지움. 그 전에는 167개
- `node scripts/quality.mjs release --force`: 아래 4절에 최종 결과 기록

## 4. 최종 release 검사

- `node scripts/quality.mjs release --force`: **PASS** (2026-11-14 13:34:17 KST) — lint 8.4초, typegen 1.5초, typecheck 4.7초, test 4.2초, build 13.4초
- 13:44 `youtube.ts` 포맷 선택식 수정 후 `quality.mjs task` PASS(13:47), `release --force` **PASS** (13:50:20 KST) — lint 8.6초, typegen 1.4초, typecheck 4.6초, test 4.3초, build 13.8초
- 14:05 연습 템플릿 삭제(코드·테스트 55개·의존성 3개) 후 `quality.mjs task` PASS, `release --force` **PASS** (14:13:05 KST) — lint 8.9초, typegen 1.5초, typecheck 4.1초, test 3.9초(112개), build 17.2초. 삭제 직후(14:07) 메인 화면을 브라우저로 다시 열어 브리핑·워커 상태 표시 확인
- 14:19 Host 헤더 수정 후 **PASS**(14:20:03). 14:25–14:45 검수 대응(W5·W6 테스트, 답변 누적, 바로 정리) 후 **PASS**(14:38:50), 문서 정리 뒤 최종 **PASS**(14:48:58 KST) — lint 8.9초, typegen 1.4초, typecheck 6.4초, test 5.0초(125개), build 15.4초
