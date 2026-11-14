# 잠자리채 작업 인계 (새 세션은 이 파일부터 읽는다)

갱신: 2026-11-14 14:49 KST(kiro-cli 세션 `sess_5b231bf0`, Codex 검수 대응 완료·미커밋). 이전: 13:36 세션 `sess_b4b2809d`. 제출 18:00(사용자 자료 기준, 현장 재확인).

> 지금 실행 중(14:49): dev 서버(cmd pid 20656, http://localhost:3000), 워커 npm pid 33428(로그 `.data/worker8.out.log`), **휴대폰용 프로덕션 서버**(npm pid 28052, `npm.cmd run start -- -p 3001 -H 0.0.0.0`, http://172.24.96.178:3001, 로그 `.data/start3001.out.log`. 코드를 바꾸면 build 후 재기동), 워커 npm pid 20916 / node pid 33668(로그 `.data/worker6.out.log`, 13:44 youtube.ts 수정 반영). 진단 스크립트 `.data/diag-*.ts`, `.data/diag-submit.mjs`(담기+맡기기 API 호출, git 제외).

## 1. 먼저 읽을 것 (순서)

1. `AGENTS.md` — 공통 규칙(완료 기준: `node scripts/quality.mjs task` PASS 후에만 `[x]`)
2. `challenge.completed.md` — 문제 원문, 확정/제안/제약 구분, 연동 점검 결과
3. `.kiro/specs/jamjarichae/requirements.md` → `design.md` → `tasks.md` (Quick Spec, 활성 Spec)
4. 이 파일의 4절(남은 작업)

어제 연습 템플릿(`challenge.md`, `.kiro/specs/mvp/`, `src/domain/program-report.ts`, `src/lib/ai`, skills·workflows·powers 등)은 14:05 사용자 지시로 삭제했다(5절 참고).

## 2. 사용자 확정 사항

- 서비스명 **잠자리채**, 한 줄 소개 **"날아가는 생각, 잠자리에서 잡아드립니다"**
- 대회 주제: 내 일상에 바로 적용할 수 있는 서비스(나와 주변 사람이 매일 겪는 작은 불편). 심사 Kiro 활용 35 / 작동 30 / 문제정의 20 / 사용자 가치 15. AI 평가 + 운영진 검토
- 작업 방식: 어제 템플릿 절차(change-topic 등) 대신 Kiro Spec 방식(요구→설계→작업). **3시간 안에 제출할 MVP, 속도 우선, Quick Spec**
- UI 참고: 루트의 `Neo-Brutalism Mobile App UI Design _ Tuckii.jpg`(굵은 검은 테두리, 하드 그림자, 노랑·분홍·보라·초록, 폴더 탭 카드) → 적용함
- 컨텍스트가 줄면 이 인계 파일을 남길 것

## 3. 현재 상태 (실제 실행으로 확인한 것만)

| 항목 | 상태 | 근거 |
|---|---|---|
| 도메인 계약·판정·렌더 | 완료 | `src/domain/jamjarichae/*`, 테스트 44개 |
| 저장소·URL 가드·서비스·워커 로직 | 완료 | `src/lib/jamjari/*`, 테스트 43개(총 87) |
| `node scripts/quality.mjs task` | PASS | 13:00경 typegen·typecheck·test PASS, `npm.cmd run lint` 통과 |
| 워커 프로세스 | 동작 | `npm.cmd run worker`. 13:44 재시작(npm pid 20916 / node pid 33668) |
| 실제 kiro-cli 실행 | W3 32초, W1 3회, W4 32초, **W5 웹 17초·유튜브 31초(프레임 6장), W6 10초**(13:40–13:47) | `.data/worker*.out.log`, `.data/jamjarichae/jobs/*.json`, `docs/integration-status.md` 2절 |
| 브라우저(Edge, Playwright MCP) | 확인 | 1440px: 담기→맡기기→브리핑→검토 체크→다운로드(attachment) / 잘못된 조합 오류 / 보고서 CSP·스크립트 없음 / W4 iframe origin null·쿠키 SecurityError·버튼 동작 / 390px 가로 넘침 원인(장식 원) 수정함 |
| dev 서버 | 실행 중 | `npm.cmd run dev` Start-Process(pid 20656), http://localhost:3000 |

연동 미구성(가짜로 채우지 않음): Anthropic 키, Google OAuth, Calendar MCP, Notion 토큰. Notebook 공개 API는 영상 생성 미지원(로드맵). 이미지 내용 분석 미연결.

git: 어제 연습(job-choice) WIP는 타입 오류가 있어 `git stash@{0}`("practice job-choice WIP …")로 보관 + `.kiro/runs/backup-practice-job-choice-20261114.patch`. 복구는 `git stash pop`. 13:57에 제출 레포 `team/main`으로 push함(4절). 이후 push도 사용자 지시가 있을 때만.

### 13:08 추가 확인

- 재시작 복구 실증 **성공**: 작업 `j_ffefff1abb396176`(W1 실제) 실행 중 워커 강제 종료(13:05:25) → 새 워커(pid 30340) 기동 → lease 만료 뒤 04:06:23Z "워커 중단 감지 → 체크포인트부터 재개(시도 2)", ingest 단계 재실행 없음
- 같은 작업 시도 2에서 kiro-cli 응답이 스키마 검증 실패 → `invalid_output` → 재시도 예약(60초 뒤, 시도 3). **원인 미조사**
- 이후 `node scripts/quality.mjs task` PASS, `npm.cmd run lint` 통과
- tasks.md: 1·2·3·4·6 `[x]`. 5는 api.test.ts 미작성, 7은 integration-status.md 미작성이라 `[ ]`
- 실행 중 프로세스: 워커 pid 30340(로그 `.data/worker3.out.log`), dev 서버 pid 20656

## 4. 남은 작업 (tasks.md 기준)

- [x] **invalid_output 원인 조사** (13:17 완료): kiro-cli 세션 로그(`~/.kiro/sessions/c2f72bad9d218502/sess_3d749dc1-…/messages.jsonl`, 04:07:28Z)의 시도 2 최종 응답을 `.data/diag-invalid-output.ts`로 같은 `extractJson`+스키마에 다시 넣어 확인 → **`howItWorks` 7개(상한 6) 1곳 `too_big`**. 시도 3 응답(6개)은 통과, 작업 최종 `completed`(attempts 3).
  - 수정: `outputs.ts`에 `list()` 추가 — 표시용 목록은 상한 초과 시 앞에서부터 잘라 씀(문자열 길이·`ideas` 개수는 계속 엄격). `prompts.ts` 개념 프롬프트에 목록 상한 명시. `worker.ts` `askKiro`가 어긴 필드 경로·코드(값 제외)를 오류 메시지와 재시도 기록에 남김
  - 확인: 시도 2 원본 응답이 이제 스키마 통과(`schema OK`), 테스트 92개 통과(+5), `node scripts/quality.mjs task` PASS(13:16)
  - 워커 재시작: pid 30340 종료 → 새 워커(npm pid 31248 / node pid 31052, 로그 `.data/worker4.out.log`)
- [x] tasks 5 (13:19 완료): `src/app/api/jamjari/api.test.ts` 20개(헤더 없는 쓰기 403, 다른 Origin 403, 조합 거부 422, 담기 201·중복 200, 맡기기, 취소 409, 없는 ID·경로 조작 404, 답변 재큐, W2 링크 검증, 보고서·체험 CSP). 전체 테스트 167개 통과(잠자리채 112), `quality.mjs task` PASS, lint 통과 → tasks.md 5 `[x]`
- [x] tasks 7 (13:26 완료): `docs/integration-status.md` 작성. 실제 작업 5건(W3 32초, W1 59초, W4 32초, W1 재시작 복구 4분 7초, W1 56초), 브라우저로 W3·W4·W1 결과 확인(13:24–13:25)
  - **새로 발견·수정**: W1 웹 검색이 headless에서 전부 거부되고 있었음(신뢰 도구 `web_search`가 kiro-cli 3.3 V3의 `remote_web_search`를 덮지 못함). 이전 W1 2건은 web_fetch로만 자료 수집 → 위 3절의 "W1 web_search 확인"은 틀린 기록. `kiro.ts` `WEB_TOOLS = ["web_fetch","remote_web_search"]`로 수정 후 실제 W1 `j_c11cae908b2ee864`에서 검색 3회 성공·거부 0회
  - 워커 재시작: 새 워커 npm pid 15292 / node pid 32136, 로그 `.data/worker5.out.log`
- [x] 문서 (13:34 완료): `docs/integration-status.md`, `docs/skill-adapters.md`, `docs/evidence.md`(요구→코드→테스트→시연 + Kiro 활용 증거), `docs/DEMO.md`(3분 대본, 연습 주제 대본을 교체), `README.md` 앞부분(잠자리채 소개·경로별 오늘 상태·실행법)과 맨 아래 `## 팀`(팀명 한글 _입력 필요_)
  - 대본 근거로 브라우저 재확인(13:24–13:31): 잘못된 조합 안내 2줄·담기 버튼 잠김, 샘플 담기→맡기기(1)→10초 안에 완료, 브리핑 "맡긴 9개 중 완료 8, 외부 조치 필요 1", 연결 상태 6줄
- [x] `node scripts/quality.mjs release --force` **PASS** (13:34:17): lint·typegen·typecheck·test(167개)·build. 이후 문서 시각 표기만 고침 → tasks.md 8 `[x]`. **tasks.md 1–8 모두 `[x]`**
- [x] W5·W6 실제 실행 (13:40–13:50, 세션 `sess_5b231bf0`)
  - 13:39 dev 서버(200)·워커(심장박동 정상) 살아 있음 확인
  - W5 웹 `j_3eb9d54aa7b198eb`(ko.wikipedia 잠자리) 17초 completed, 본문 6,359자
  - W5 유튜브 `j_09e833261c0fa5ea`(jNQXAC9IVRw, 19초 영상) 29초 partial, **프레임 0장** → 원인: yt-dlp `-f best…/worst`가 "Requested format is not available". `youtube.ts` 선택식을 영상 전용 `bv*[height<=480]…` 우선으로 수정, 워커 재시작(npm 20916 / node 33668, `.data/worker6.out.log`)
  - W5 유튜브 재실행 `j_c173998ada19c72b` 31초 partial, 자막 6줄 + 실제 프레임 6장. Edge로 이미지 6장·시점 링크 6개 확인
  - W6 `j_b15b2e4a438dd7c6` 10초 awaiting_external_action, 행사/신청 마감 구분, URL 0개
  - `integration-status.md`(1·2·3.3·5절), `evidence.md`(R3.7–R3.10, 엔진 횟수, 4절), README 경로 표 갱신
  - `quality.mjs task` PASS(13:47), `release --force` **PASS(13:50:20)**
- [x] **제출 레포 이전·push (13:57, 사용자 "푸시하고 진행하자" 지시)**: 레포 `https://github.com/stat-yongsan/kirothon-team-030`(Public), 팀명 **AX:IS**
  - git 구성: remote `team` 추가. 기존 로컬 `main`은 `kirothon-2026-main`으로 이름 변경(연습 레포 이력 + 오늘 작업 커밋 `424044b`, push 안 함). 새 `main` = 템플릿 `7a216c7` 위에 같은 트리를 커밋 1개(`3c50f35`)로 올림 → `team/main` 추적. `origin`(kirothon-2026)은 그대로, push 안 함. stash@{0}은 그대로
  - 올린 것: 코드·테스트·`.kiro/`(specs·steering·agents·skills·workflows·settings)·docs·README(템플릿 섹션 형식으로 재작성)·`BUILD_REPORT.md`(신규)·`SUBMISSION_GUIDE.md`(템플릿)·`.gitignore`(템플릿 항목 합침). 이전 README의 연습 환경 설명은 `docs/PRACTICE_TEMPLATE.md`로 옮김
  - 안 올린 것(`.git/info/exclude`): `Neo-Brutalism … Tuckii.jpg`, `KIROTHON_DAYPATCH_20261114.html`, `컨셉 보드 … .pdf`. `KIRO Basic.pdf`는 원래 .gitignore. `.env.local`·`.data/`·`.kiro/runs/`는 gitignore
  - push 전 검사: 비밀값·키·개인 이메일 패턴 0건, 300KB 넘는 파일 없음, `.env.example` 값 비어 있음. 공개 문서에 Vercel 계정 핸들(`docs/SETUP_STATUS.md`, `docs/MANUAL.html`, `docs/PRACTICE_TEMPLATE.md`)은 남아 있음(비밀값 아님, 사용자에게 알림)
  - 로그아웃 상태(web_fetch)로 레포 첫 화면 README 표시 확인
  - AGENTS.md: 제출 원격 `team`, 로컬 `main` → `team/main`만 push, 18:00 마감, 외부 자료는 exclude로 갱신
- [ ] 제출 남은 것(사용자): README **Demo 줄 영상 링크**, 최상단 **`PRESENTATION.pdf`**, 18:00 전 마지막 push. 목표: **17:00까지 제출 완료**(사용자 지시, 수정 여유 1시간)
- [x] **연습 템플릿 삭제 + README 완성 (14:05–14:15, 사용자 지시)**
  - 삭제(git rm): 연습 주제 코드(`src/domain/{csv,format,current,types,program-report}*`, `examples/`, `fixtures/`, `src/lib/ai`, `src/lib/report`, `src/app/api/draft`, `src/components/{Workbench,AnalysisPanel,DraftPanel,ui}.tsx`), `.kiro/specs/mvp`, `.kiro/skills`, `.kiro/workflows`, steering `kickoff·ship·api`, `powers/`, `docs/{MANUAL.html,RUN_PROMPTS.md,SETUP_STATUS.md,PRACTICE_TEMPLATE.md,examples}`, `scripts/{check-api,doctor}.mjs`, `CLAUDE.md`, `challenge.md`. 의존성 `@anthropic-ai/sdk`·`papaparse`·`@types/papaparse` 제거. Vercel 계정 핸들이 있던 문서도 이때 사라짐
  - 고침: `AGENTS.md`, steering `product·structure·tech·ui`, agents `builder·reviewer·demo-editor`(잠자리채 Spec 기준), `.env.example`(잠자리채 선택 변수만)
  - 남김(로컬만, 레포에 없음): `git stash@{0}`(연습 WIP), 브랜치 `kirothon-2026-main`, 루트 `KIRO Basic.pdf` 등 제외 파일, `.env.local`
  - README: 템플릿 섹션 전부 채움(문제 정의·기능·시나리오 4단계·기대 효과 표·차별점 표·설치·테스트 표·팀). 스크린샷 4장 `docs/images/`(main·briefing·report-w1·prototype, 14:08–14:10 Edge). 팀 표: `stat-yongsan` / 기획·설계·개발·시연(1인) — 이름은 사용자가 바꿀 수 있음
  - `docs/DEMO.md`: 녹화용 주소 표(결과 주소 7개 HTTP 200 확인 14:10), W5·W6 장면 추가
  - 검사: 테스트 112개, `quality.mjs task` PASS, lint 통과, `release --force` **PASS(14:13:05)**
- [x] **휴대폰 테스트 주소 (14:16–14:22)**: dev 서버는 LAN에서 HMR·폰트 403 → 프로덕션 서버 3001을 0.0.0.0으로 띄움. 담기 403 `cross_origin` 발견 → `http.ts` guard를 Host 헤더 비교로 수정 + 회귀 테스트(113개). task PASS, release PASS(14:20:03). Edge 390px LAN 주소로 담기→맡기기→완료 확인. `integration-status.md` 3.4절
- [x] **Codex 검수 대응 (14:25–14:49, 세션 `sess_5b231bf0`)** — 자세한 내용 tasks.md 9, integration-status.md 2·3.5–3.7절
  - 실제 실행: W1 화면 흐름 63초, W2 58초(외부 조치 필요), W6 질문 → 화면 답변 → 재개, W5 오류 2종, "바로 정리" W3 38초. 사진 선택 + 담기(샘플) 확인
  - 수정: 답변 누적(`job.ts` `answers`), 연도 재확인(`schedule.ts` `verifyYearStated`), 입력 단계 실패 배지 `code`, "바로 정리" 체크(기본 켬, `JamjariApp.tsx`)
  - 정정: "모델이 답변을 지어냄"은 오판이었음(14:28:57 사용자 답변이 있었음)
  - 테스트 125개, task PASS, release PASS(14:48:58). **미커밋**(검수 요청이 push 제외라 커밋도 안 함). 변경 파일 14개
  - 사용자 메모: 자동화 Edge 창(Playwright)에서는 파일 선택 창이 가로채져 안 열림 → 일반 브라우저에서 테스트. 14:44 자동화 창 닫음
  - 실행 중: dev 3000(pid 20656), 워커 npm 33428(로그 `.data/worker8.out.log`), 프로덕션 3001 npm 28052(14:49 재기동)
- [ ] Google 로그인(JWT): 사용자 결정 "비밀값은 나중에, 로그인은 나중에 붙이자"(13:5x). OAuth 클라이언트 ID·비밀값 받으면 착수

## 5. 실행 방법

```powershell
npm.cmd run dev          # 화면 http://localhost:3000
npm.cmd run worker       # 별도 터미널. 꺼져 있으면 화면에 "워커 꺼짐"
node scripts/quality.mjs task
```

데이터: `.data/jamjarichae/`(git 제외). 지우면 작업 기록이 모두 사라진다.

## 6. 주의

- 결과를 실제보다 좋게 보고하지 않는다. W2는 영상 링크를 만들지 않고 "외부 조치 필요", W6는 Calendar 미연결로 일정 URL 없음, W5 유튜브는 자막 기반(화면 내용 미확인) partial
- kiro-cli는 작업별 빈 폴더(`.data/jamjarichae/sandbox/{jobId}`)에서 stdin 프롬프트로 실행, 신뢰 도구는 W1·W2만 `remote_web_search,web_fetch`
- `next dev`가 네트워크 인터페이스에도 열린다. 쓰기 API는 `x-jamjari: 1` 헤더와 같은 출처를 요구하지만 GET은 열려 있다(로컬 시연 전제)
