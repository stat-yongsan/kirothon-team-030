# Design (Quick Spec) — 잠자리채

> 3시간 안에 제출할 MVP 기준. 요구사항 ID는 `requirements.md`의 R1–R5.

## 구조

```
브라우저(한 페이지: 담기 · 밤 작업 보드 · 아침 브리핑 · 연결 상태)
   │  fetch /api/jamjari/*   (3초 폴링)
   ▼
Next.js Route Handlers ──── 같은 파일 저장소 ──── 워커 프로세스 (npm.cmd run worker)
 - POST jobs (담기, R1)        .data/jamjarichae/      - claimNext(lease) → processJob
 - POST run  (맡기기, R2)       jobs/{id}.json          - 단계 체크포인트(R2.4)
 - POST jobs/{id}/answer|cancel artifacts/{id}.html    - kiro-cli headless (stdin, 빈 sandbox)
 - GET  jobs (+브리핑·연결)      locks/{id}.lock        - URL 수집기(SSRF 차단)
 - GET  /r/{id}  보고서(CSP)     worker.json(심장박동)   - yt-dlp·ffmpeg(W5 유튜브)
 - GET  /p/{id}  체험(sandbox)
```

## 결정과 이유

| 결정 | 이유 | 버린 대안 |
|---|---|---|
| 작업별 JSON 파일 + `wx` 잠금 + 임시파일 rename | tech.md "DB 없음", 두 프로세스가 안전하게 공유 | SQLite(새 의존성), 메모리 큐(재시작 시 유실) |
| 워커는 별도 Node 프로세스, TS 직접 실행(Node 22.19 타입 제거) | 브라우저와 무관하게 실행(R2.2), 빌드 단계 없음 | Next 요청 안에서 실행(요청 시간 제한) |
| 생성 엔진 kiro-cli headless V3 | 이 PC에서 동작 확인, Anthropic 키 없음, Kiro 활용 | 모델 직접 호출(키 없음) |
| 코드가 판정: 조합·날짜·아이디어 개수·HTML 안전·일정 모호성·출처 응답 | 숫자·규칙은 코드(product.md) | 모델 자기 보고만 신뢰 |
| 샘플 모드 = 같은 파이프라인 + 고정 데이터 | 심사자가 크레딧·연결 없이 체험(R5.5) | 별도 데모 화면(실제 경로와 달라짐) |
| 미연결 단계는 상태로 정지 | 가짜 URL·완료 위장 금지(R3.4, R3.10) | 일정 추가 폼 URL을 등록 결과처럼 반환 |

## 모듈

| 파일 | 역할 | 요구 |
|---|---|---|
| `src/domain/jamjarichae/contracts.ts` | 6경로 표, `validateCapture`, 상태·단계, `captureDate` | R1 |
| `src/domain/jamjarichae/job.ts` | Job/Result 타입, 화면용 `toView` | R2, R3.11 |
| `src/domain/jamjarichae/outputs.ts` | Kiro 출력 zod 스키마, `checkIdeas`, `checkPrototypeHtml`, `extractJson` | R3.5, R3.6 |
| `src/domain/jamjarichae/schedule.ts` | 일정 후보 판정 `decideSchedule`, 시간대 변환, 알림 | R3.9, R3.10 |
| `src/domain/jamjarichae/briefing.ts` | 상태 집계·상위 3개·질문 | R4.1, R4.2 |
| `src/domain/jamjarichae/render.ts` | 신뢰 HTML 템플릿(전부 이스케이프) | R5.4 |
| `src/domain/jamjarichae/fixtures.ts` | 샘플 입력·고정 출력 | R5.5 |
| `src/lib/jamjari/store.ts` | 파일 저장소, 잠금, `claimNext`, 심장박동 | R2.2–R2.4, R2.8 |
| `src/lib/jamjari/kiro.ts` | kiro-cli 실행(stdin, trust-tools, 시간 상한) | R5.1, R5.2 |
| `src/lib/jamjari/prompts.ts` | 경로별 지시 + 데이터 블록 | R5.1 |
| `src/lib/jamjari/fetch-url.ts` | URL 수집기·출처 응답 확인 | R3.2, R5.3 |
| `src/lib/jamjari/youtube.ts` | 메타데이터·자막·프레임 | R3.8 |
| `src/lib/jamjari/worker.ts` | `processJob`: 단계·재시도·6경로 | R2.3–R2.5, R3 |
| `src/lib/jamjari/connections.ts` | 연결 상태 판정 | R4.6 |
| `scripts/jamjari-worker.ts` | 워커 루프(점유·심장박동·종료 처리) | R2.2, R2.8 |
| `src/app/api/jamjari/**`, `src/app/r|p/**` | API·보고서·체험 뷰어 | R1–R4 |
| `src/components/jamjari/JamjariApp.tsx` | 한 페이지 UI | R1, R2.6, R4 |

## 상태 전이

```
draft ─맡기기→ queued ─점유→ running ─┬→ completed / partial
   └취소→ cancelled         ▲         ├→ needs_input ─답변→ queued
                            │         ├→ awaiting_external_action (W2 영상, W6 Calendar)
          scheduled(runAt) ─┘◀재시도─┤
          running(lease 만료) ─재점유─┘└→ failed
```

## 오류 처리

- `StepError(stage, code, retryable, nextAction)`. 재시도 가능: timeout, invalid_output, engine_error, internal. 불가: no_readable_input, unreadable_url, too_long, no_transcript, unsafe_prototype, video_unavailable.
- 실패해도 이미 저장한 결과물은 지우지 않는다. 로그에는 작업 ID와 오류 코드만 남긴다.

## 테스트 전략 (Vitest, 손 검산 상수)

- contracts: 6경로 허용/거부, URL 형식, KST 자정 경계 날짜
- schedule: 행사+마감 혼재, 연도 누락, 후보 2개, 지난 일정, 종료 누락 가정, 알림 UTC 시각, 지난 알림
- outputs: 아이디어 4개·중복·축 1개, 체험 HTML의 fetch·외부 src·스크립트 없음, 로그 섞인 JSON 추출
- store: 생성·중복 키·점유·lease 만료 재점유
- worker(가짜 kiro): W3 완료, W1 모호 → 질문, W6 → 외부 조치(URL 없음), 체크포인트 재개 시 엔진 재호출 0회, 입력 속 지시가 도구 목록을 바꾸지 못함, 샘플 모드 엔진 호출 0회
- fetch-url: 사설·루프백·메타데이터 주소 차단
- 실제 연동 smoke: 워커 + kiro-cli로 W3 1회, 가능하면 W1·W4 1회. 브라우저에서 담기→맡기기→브리핑→HTML/체험 열기 확인
