# BUILD REPORT

> 잠자리채, 2026-11-14 KST. 개발 도구는 kiro-cli 3.3(V3 엔진), 개발 세션 모델은 `claude-opus-5.5`입니다. 앱이 런타임에 실행하는 kiro-cli는 모델을 지정하지 않아 Auto로 동작합니다(런타임 세션 기록 `modelId: auto`). 이 문서에는 실제로 실행하고 기록이 남은 것만 적었습니다. 세부 근거는 [docs/evidence.md](docs/evidence.md)와 [docs/integration-status.md](docs/integration-status.md)에 있습니다.

## Kiro 활용 내역

| 단계 | 사용한 Kiro 기능 | 무엇을 했는지 | 결과물 위치 |
|---|---|---|---|
| 기획 | Steering, 문제 원문 정리 | 대회 원문을 그대로 두고 [확정]/[제안]/[제약]을 구분해 정리했습니다. 이 PC에서 연동 가능 여부(kiro-cli headless, Anthropic 키, Google OAuth, Calendar, Notion, Notebook API, yt-dlp·ffmpeg)를 실제로 실행해 확인했습니다 | `challenge.completed.md`, `.kiro/steering/product.md` |
| 기획 | Spec (requirements, Quick Spec) | 요구 5개(R1–R5), 수용 기준 38개, 가정 목록 A1–A9를 작성했습니다. 여섯 경로(W1–W6)는 기능 3개(담기·맡기기·꺼내보기) 안에 배치했습니다 | `.kiro/specs/jamjarichae/requirements.md` |
| 설계 | Spec (design) | 파일 기반 영속 큐 + 별도 워커 + kiro-cli 생성 엔진 구조를 정했고, 버린 대안을 이유와 함께 남겼습니다. 상태 전이, 오류 분류(재시도 가능/불가), 테스트 전략을 정리했습니다 | `.kiro/specs/jamjarichae/design.md` |
| 구현 | Spec (tasks) + kiro-cli 에이전트 | 초기 구현 뒤 검수 대응과 화면 개편을 포함해 작업 10개를 완료했습니다. 완료 표시는 `node scripts/quality.mjs task`의 PASS를 기준으로 했습니다 | `.kiro/specs/jamjarichae/tasks.md`, `src/domain/jamjarichae/`, `src/lib/jamjari/` |
| 구현 | kiro-cli headless를 앱의 런타임 엔진으로 사용 | 워커가 작업마다 `kiro-cli chat --v3 --no-interactive`를 작업별 빈 폴더에서 실행합니다. 입력은 stdin으로 넘기고, 신뢰 도구는 경로별로 고정합니다(W1·W2만 `remote_web_search`, `web_fetch`). 14:45 기준 실제(비샘플) 작업 21건(사용자 테스트 포함) | `src/lib/jamjari/kiro.ts`, `prompts.ts`, `worker.ts` |
| 구현 | 외부 Agent Skill 절차 이식 | jwynia `brainstorming`(W3)과 kar2phi `video-lens`(W5) 절차를 headless 프롬프트와 코드 검사로 옮겼습니다. 커밋과 라이선스를 기록했습니다 | `docs/skill-adapters.md` |
| 검증 | 품질 스크립트 | `quality.mjs task`(typegen·typecheck·test)와 `release --force`(lint·typegen·typecheck·test·build)를 실행했습니다. 테스트는 138개(파일 9개)입니다. 실행 기록은 `docs/integration-status.md`에 있습니다 | `scripts/quality.mjs`, `*.test.ts` |
| 검증 | MCP (Playwright, Edge) | 실제 브라우저로 확인했습니다. 담기 → 맡기기 → 브리핑 → HTML 열기·다운로드, 잘못된 조합 안내, 보고서 CSP·스크립트 0개, 체험 iframe의 origin null·쿠키 SecurityError·버튼 동작, 유튜브 보고서의 프레임 6장·시점 링크, 390px 가로 넘침(수정함) | `.kiro/settings/mcp.json`, `docs/integration-status.md` |
| 검증 | 외부 검수 대응 | 다른 도구(Codex)의 검수 의견을 받아 미검증 경로(W2, W6 질문 흐름, W5 오류)를 실제로 돌리고, 발견한 결함 2개를 고쳤습니다. 검수 의견 중 기록과 달랐던 점은 정정했습니다 | `.kiro/specs/jamjarichae/tasks.md` 9, `docs/integration-status.md` 3.5–3.7절 |
| 검증 | kiro-cli 세션 로그 분석 | 런타임 kiro-cli 세션 로그(`messages.jsonl`)를 읽어 실패 원인 2개를 찾았습니다. 웹 검색 도구가 전부 거부된 문제와 형식 오류(목록 7개 > 상한 6개)입니다. 유튜브 프레임 0장은 같은 명령을 직접 재실행해 원인을 찾았습니다 | `docs/integration-status.md` 3절 |
| 기타 | Steering, Custom agents, 인계 파일 | 공통 규칙(`AGENTS.md`)과 steering 4개(product·structure·tech·ui)를 잠자리채 기준으로 고정했습니다. 에이전트 builder(저장·턴 종료 Hook으로 `quality.mjs`)·reviewer·demo-editor는 **설정만 했고 오늘은 쓰지 않았습니다**. 개발 세션 3개는 기본 에이전트로 진행했고 검사 명령은 직접 실행했습니다. 컨텍스트가 줄 때마다 인계 파일을 갱신해 세션 3개(`sess_4f861dd9`, `sess_b4b2809d`, `sess_5b231bf0`)를 이어 갔습니다 | `.kiro/steering/`, `.kiro/agents/`, `docs/HANDOFF_JAMJARICHAE.md` |

## 개발 과정에서 바뀐 점

- **생성 엔진**: 처음 템플릿은 Anthropic API를 서버에서 직접 호출하는 구조였습니다. 키가 없어서, 이 PC에서 동작을 확인한 kiro-cli headless를 워커의 생성 엔진으로 바꿨습니다.
- **작업 방식**: 전날 준비한 템플릿 절차(change-topic) 대신 Kiro Spec 방식(requirements → design → tasks)으로 진행했습니다. 3시간 제출 기준에 맞춰 Quick Spec으로 줄였습니다.
- **DB 없음 규칙과 영속 큐**: 새 DB 의존성 없이 작업별 JSON 파일, `wx` 잠금, 임시 파일 rename, lease로 로컬 영속 큐를 만들었습니다. 그 대가로 Vercel 배포본에서는 큐가 동작하지 않습니다.
- **외부 연동과 미연결 처리**: 초기에는 Calendar·Notion 연결 정보가 없어 외부 조치 필요로 멈췄습니다. 이후 소유자의 환경변수로 Calendar 등록과 Notion 기록을 실측했습니다. Notebook 영상 생성은 공개 API가 없어 HyperFrames 로컬 렌더로 대체했습니다. Google 로그인과 이미지 분석은 미구현입니다([실행 기록](docs/integration-status.md) 6·8절).
- **연습 템플릿 정리**: 대회 전날 준비한 연습 주제(비교과 결과보고서 검증) 코드, Anthropic 어댑터, change-topic 등 skills·workflows·데모 Power, 연습용 steering 3개와 문서는 오늘 쓰지 않아 제출 전에 지웠습니다. 쓰지 않는 의존성(`@anthropic-ai/sdk`, `papaparse`)도 뺐습니다.
- **UI**: 처음 제안은 깊은 밤 남색 계열이었습니다. 사용자가 준 참고 이미지에 맞춰 네오 브루탈리즘(굵은 테두리, 하드 그림자, 노랑·분홍·보라·초록)으로 바꿨습니다.

## 어려웠던 점과 해결 방법

| 문제 | 원인 | 해결 |
|---|---|---|
| W1 웹 검색이 headless에서 전부 거부됨. 모델은 web_fetch로만 자료를 모았음 | kiro-cli 3.3 V3의 검색 도구 ID는 `remote_web_search`인데, `--trust-tools=web_search`로는 신뢰 목록에 들어가지 않았음. `--no-interactive`라 승인 요청이 바로 취소됨 | 세션 로그에서 `denied`를 확인하고 신뢰 도구 이름을 고쳤습니다. 실제 W1 재실행에서 검색 3회 성공, 거부 0회 |
| 형식 오류(`invalid_output`)로 재시도 1회 | 모델이 목록 상한(6개)을 넘겨 7개를 반환 | 표시용 목록은 상한까지만 잘라 쓰게 했습니다. 판정 대상(아이디어 개수)은 계속 엄격하게 검사합니다. 오류 기록에 어긴 필드 경로를 남깁니다 |
| 유튜브 프레임 0장 | yt-dlp가 결합 포맷 선택식(`best…/worst`)을 거부 | 프레임만 필요하므로 영상 전용 스트림(`bv*`)을 먼저 고르게 바꿨습니다. 재실행에서 6장 캡처 |
| 워커가 작업 중에 죽으면? | 한 프로세스가 장시간 외부 도구를 실행 | lease와 단계 체크포인트를 두었습니다. 실제로 강제 종료 → 새 워커 재점유 → 끝난 단계 재실행 없이 완료(4분 7초) |
| 질문에 두 번 답하면 앞선 답이 사라짐(W6) | 새 질문이 생길 때 이전 답을 지웠음 | 질문·답을 누적(`answers`)해 엔진과 코드 판정에 모두 넘김. 실제 화면 답변으로 재확인 |
| 다른 기기(휴대폰)에서 담기 403 | 출처 검사가 서버 바인딩 주소(0.0.0.0)와 비교 | 브라우저가 보낸 Host 헤더와 비교, 회귀 테스트 |
| 모델이 만든 HTML을 안전하게 보여 주기 | 생성 코드에 네트워크·저장소·상위 창 접근이 섞일 수 있음 | 코드가 정적 검사를 합니다. 통과한 페이지만 `sandbox="allow-scripts"` iframe과 CSP `default-src 'none'`으로 제공합니다. 보고서는 신뢰 템플릿에 모델 출력을 이스케이프해 넣습니다 |
