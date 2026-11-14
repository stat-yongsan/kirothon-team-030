# 연동 상태와 실제 실행 기록 — 잠자리채

> 기록: 2026-11-14 13:25 KST, kiro-cli 세션. 13:49 W5 웹·유튜브, W6 실제 실행 추가. 14:45 검수 대응(W1 화면 흐름, W2, W6 질문 흐름, W5 오류, 바로 정리) 추가. 이 PC(Windows, Node 22, kiro-cli 3.3.0)에서 실제로 실행한 것만 적는다.
> 근거 파일: `.data/jamjarichae/jobs/*.json`(작업 기록), `.data/worker*.out.log`(워커 로그), `~/.kiro/sessions/**/messages.jsonl`(kiro-cli 세션 로그). `.data/`는 git에 올리지 않는다.

## 1. 연결 상태

| 연결 | 상태 | 근거 |
|---|---|---|
| kiro-cli headless (생성 엔진) | **동작** | `chat --v3 --no-interactive`, stdin 프롬프트, 작업별 빈 폴더. 아래 2절의 실제 작업 5건 |
| 웹 검색(W1·W2) | **동작 (13:21 수정 후)** | 신뢰 도구 이름을 `remote_web_search`로 고친 뒤 검색 3회 결과 반환, 거부 0회(3절) |
| web_fetch(W1·W2) | 동작 | 실제 W1 3건 모두 web_fetch로 출처 페이지를 열람 |
| 출처 응답 확인(코드) | 동작 | 워커가 출처 URL마다 직접 접속해 상태 코드 기록(200/206) |
| 워커 재시작 복구 | **동작** | 실행 중 강제 종료 → 새 워커가 lease 만료 뒤 재점유, 끝난 단계 재실행 없음(4절) |
| Anthropic API | 미사용(키 없음) | `.env.local`의 `ANTHROPIC_API_KEY` 비어 있음. 생성은 kiro-cli가 맡음 |
| Google 로그인 | 미구성 | OAuth 클라이언트 없음. 화면에 "미구성"으로 표시 |
| Google Calendar | **동작 (REST 토큰, 16:21 재확인)** | refresh token으로 `calendars/primary/events` 생성·조회·삭제. 토큰 스코프는 `calendar.events`뿐이라 `calendarList` 조회는 403(일정 생성에는 무관). MCP(`google-calendar`)는 쓰지 않아 `.kiro/settings/mcp.json`에서 뺐다 |
| Notion | **동작 (16:21 재확인)** | `잠자리채 › 날짜 › 경로 › 작업` 페이지 생성·블록 조회 200. 입력 단계에서 실패한 작업은 기록하지 않고 `not_configured`로 남는다(6절 W1 사진 행) |
| W2 영상 렌더(HyperFrames) | **사용 가능 (15:58 확인)** | Gemini Notebook 공개 API에 영상 생성이 없어 15:50에 교체. skills.sh `heygen-com/hyperframes` 스킬(`.kiro/skills/hyperframes`, Apache-2.0)과 `hyperframes@0.9.43` 로컬 CLI로 MP4를 만든다. 계정·API 키 없음, 내레이션·음악 없음. 첫 렌더는 Noto Sans KR·GSAP를 인터넷에서 받는다 |
| 웹페이지 본문 수집(W5) | **동작 (13:40)** | URL 수집기가 위키백과 본문 6,359자를 읽고 kiro-cli가 요약(2절) |
| YouTube 자막·프레임(W5) | **동작 (13:45 수정 후)** | yt-dlp 자막(en) 6줄 + ffmpeg 실제 프레임 6장. 13:42 첫 실행은 프레임 0장이었음(3.3절) |
| W6 일정 판정(실제 입력) | 동작, Calendar 쓰기 없음 | kiro-cli 추출 → 코드 판정 → `awaiting_external_action`, 일정 URL 없음(2절) |

## 2. 실제(비샘플) 작업 기록

| 시각(KST) | 작업 ID | 경로 | 소요 | 시도 | 결과 | 코드 검사 | 브라우저 확인 |
|---|---|---|---|---|---|---|---|
| 12:56:22–12:56:54 | `j_5e1a77d30c320de3` | W3 아이디어 5개 HTML | 32초 | 1 | completed | 5개·이름 중복 없음·각 2개 축 이상 통과 | 13:24 `/r/a_e3249a6183b4d0c5`: 아이디어 5개 제목, 스크립트 0개, 가로 넘침 없음 |
| 12:57:34–12:58:33 | `j_8503c8366d04173c` | W1 개념 HTML (MCP) | 59초 | 1 | completed | 출처 5개 중 5개 응답(200) | 이전 세션 확인 |
| 12:58:33–12:59:04 | `j_8b904f9ed3e86a0f` | W4 체험 페이지 | 32초 | 1 | completed | 정적 검사 통과(스크립트·버튼 있음, 외부 리소스·네트워크·저장소·상위 창 접근 없음) | 13:24 `/p/a_7f7462e1726b4de4`: iframe `sandbox="allow-scripts"`, "확정" 클릭 시 화면 변화, iframe 안 `document.cookie` → SecurityError |
| 13:05:16–13:09:23 | `j_ffefff1abb396176` | W1 개념 HTML (에이전트 메모리) | 총 4분 7초 (시도 3은 54초) | 3 | completed | 출처 4개 중 4개 응답(206) | — |
| 13:22:06–13:23:02 | `j_c11cae908b2ee864` | W1 개념 HTML (벡터 데이터베이스) | 56초 | 1 | completed | 출처 6개 중 6개 응답(200/206) | 13:25 `/r/a_95a1dcc0e529f39d`: 9개 절, 외부 출처 링크 6개, 스크립트 0개, CSP `default-src 'none'` |
| 13:40:41–13:40:58 | `j_3eb9d54aa7b198eb` | W5 웹페이지 요약 (`ko.wikipedia.org/wiki/잠자리`) | 17초 | 1 | completed | 수집기가 본문 6,359자 읽음(잘림 없음), 출처 응답 200 | 13:41 `/r/a_94c4403637a58985`(HTTP 확인): 요약·핵심 포인트·목차·분석 범위, 스크립트 0개, CSP `default-src 'none'` |
| 13:42:19–13:42:48 | `j_09e833261c0fa5ea` | W5 유튜브 요약 (`jNQXAC9IVRw`, 19초 영상) | 29초 | 1 | partial | 자막(en) 6줄, **프레임 0장**("장면 캡처를 확보하지 못했습니다") | 원인 3.3절 |
| 13:45:08–13:45:39 | `j_c173998ada19c72b` | W5 유튜브 요약 (같은 영상, 수정 후) | 31초 | 1 | partial | 자막(en) 6줄, 실제 프레임 6장(0:01·0:05·0:07·0:12·0:14·0:16) | 13:48 Edge `/r/a_ba6eb4e0184ad988`: 이미지 6장 640×480 로드, 시점 링크 6개(`&t=1s`…`&t=16s`), 스크립트 0개 |
| 13:47:01–13:47:11 | `j_b15b2e4a438dd7c6` | W6 일정 (북토크 메모: 행사 11/21 14–16시 + 신청 마감 11/18 18시) | 10초 | 1 | awaiting_external_action (결과 partial) | 행사 2026-11-21 14:00–16:00만 등록 대상, 신청 마감은 별도로 제외, 시간대 가정(Asia/Seoul), 알림 전날 같은 시각·당일 시작 시각, 오류 `calendar_not_connected`, 결과에 URL 0개 | 13:47 `/r/a_fdb2b1bb8a35083b`(HTTP 확인): 상태 "외부 조치 필요", 스크립트 0개 |

| 14:26:05–14:27:08 | `j_3a5c07b322760621` | W1 개념 HTML (CRDT, **화면에서 입력**) | 63초 | 1 | completed | 출처 8개 중 8개 응답, 세션 로그에 웹 검색 3회·web_fetch 2회, 거부 0 | 14:26 Edge: 메모 입력 → 담기 → 맡기기(1) → "정리 중" → 완료 |
| 14:27:08–14:28:06 | `j_eaf747db4ece89fb` | **W2** 개념 → 영상 링크 (LoRA) | 58초 | 1 | awaiting_external_action (결과 partial) | 조사 HTML 저장, 출처 8/8 응답, 오류 `notebook_video_unsupported`, 영상 URL 없음 | — |
| 15:57:3x–15:58:2x | `j_d22a38f8ff341bd9` | **W2** 샘플(RAG) → HyperFrames MP4 | 53초 | 1 | completed | 장면 7개, ffprobe: H.264 1920×1080 45.0초, 1,414,953바이트, 오류 0. 샘플 모드라 kiro-cli·Notion 호출 없음 | 16:05 브라우저 `localhost:3000`: `/v/a_841868b1b5a04e48` 재생기 duration 45·폭 1920, MP4 내려받기 버튼, 390px 가로 넘침 없음 |
| 14:28:22–14:40:47 | `j_496f010939296533` | **W6** 모호 입력(연도·시각 없음) | 실행 6회 각 10–14초 | 1 | 질문 6번·답변 5번 → awaiting_external_action | 답변 5번(14:28:57 사용자, 14:33·14:34·14:39·14:40 에이전트, 모두 화면 답변 칸). 수정 전에는 새 답이 앞선 답을 지워 연도·시각 질문이 번갈아 반복됨(3.6절). 수정 후 시각 답 → 연도 질문 → 연도 답 → 2026-11-28 14:00–16:00, 알림 2개, URL 0개. 입력 수집 단계는 처음 1회만 실행 | Edge 답변 칸 |
| 14:28:56–14:29:02 | `j_75441dded98153b4` | **W5** 유튜브 64분 영상 | 6초 | 1 | failed `too_long` | 엔진 호출 없음, 재시도 없음, 다음 행동 표시 | — |
| 14:29:02–14:29:06 | `j_9dc06b83c10df867` | **W5** 없는 영상 ID | 4초 | 1 | failed `video_unavailable` | 엔진 호출 없음, 재시도 없음 | — |
| 14:42:51–14:43:29 | `j_d6f8f849cb41f9df` | W3 아이디어 (**바로 정리**, 화면에서 입력) | 38초 | 1 | completed | 담기 1번으로 큐에 들어감(기록 "담고 바로 맡김") | 14:43 Edge: "＋ 담고 바로 정리" → 완료 카드 |

14:39 워커 재시작 때 실행 중이던 작업 `j_2fe619fd092436f3`(사용자 테스트 W3)이 강제 종료됐고, 새 워커가 lease 만료 뒤 시도 2로 이어 받아 33초 만에 완료했다(재시작 복구 두 번째 실측).

13:48 Edge로 메인 화면 확인: 브리핑 "맡긴 13개 중 완료 9, 부분 완료 2, 외부 조치 필요 2", 워커 "실행 중", 위 W5·W6 카드 표시.

W5 유튜브 결과는 설계대로 `partial`이다. 요약 근거는 자막뿐이고, 프레임은 실제 영상에서 캡처했지만 AI가 화면 내용을 보지는 않았다. W6 메모의 신청 마감에는 연도가 없었고 kiro-cli가 "2026년으로 추측"이라고 메모를 남겼다. 마감은 등록 대상이 아니어서 코드가 질문하지 않았다.

샘플 모드 작업(엔진·URL·외부 호출 없음)은 별도: W3 `j_893fa0ff5bda0e71`, W6 `j_714c0dc24acc3fe7`(awaiting_external_action), W1 `j_99bca56d84282312`. 모두 0초대, `engine: sample`.

## 3. 발견한 문제와 수정

### 3.1 웹 검색이 headless에서 전부 거부됨 (13:20 발견, 13:21 수정)

- 증상: 13:21 이전 실제 W1 2건의 `searchScope`에 모델이 "웹 검색 도구는 권한 오류로 쓰지 못했다", "검색 도구와 arXiv API 접근이 막혀 실패했다"고 적었다. 세션 로그(`sess_3d749dc1…`)에서 `tool::remote_web_search` 호출 3회가 모두 `status: denied`, 승인 요청 `"remote/web_search"`가 `cancelled`였다. 출처는 web_fetch로 직접 연 페이지뿐이었다.
- 원인: kiro-cli 3.3 V3의 웹 검색 도구 ID는 `remote_web_search`다. 워커는 `--trust-tools=web_search,web_fetch`로 실행했고, `web_search`는 이 도구를 신뢰 목록에 넣지 못했다. `--no-interactive`라 승인 요청이 바로 취소됐다.
- 수정: `src/lib/jamjari/kiro.ts`의 `WEB_TOOLS`를 `["web_fetch", "remote_web_search"]`로 바꿈. 프롬프트 문구도 맞춤.
- 확인: 단독 실행(17초)에서 검색 결과 10건 반환. 워커 재시작 후 실제 W1 `j_c11cae908b2ee864`에서 검색 3회 모두 결과 반환, 거부·취소 0회, 승인 7회(검색 3 + fetch 4).
- 이전 기록 정정: 인계 파일의 "W1 59초 완료(web_search·출처 응답 확인)"는 web_search가 아니라 web_fetch로만 자료를 모은 결과였다.

### 3.2 invalid_output 1회 (`j_ffefff1abb396176` 시도 2)

- 증상: 13:07:29 "재시도 예약(invalid_output, 60초 뒤)". 시도 3에서 completed.
- 조사: kiro-cli 세션 로그(`sess_3d749dc1…`, 04:07:28Z)에 남은 시도 2의 최종 응답을 워커와 같은 `extractJson` + `ConceptResearchSchema`로 다시 검증했다(`.data/diag-invalid-output.ts`). 문제는 1곳이었다. `howItWorks` 항목이 7개였고 상한은 6개다(`too_big`). 시도 3 응답은 6개라 통과했다.
- 수정:
  - `src/domain/jamjarichae/outputs.ts`: 표시용 목록(`howItWorks`, `keyTerms`, `history`, `sources`, `highlights` 등)은 상한을 넘으면 앞에서부터 상한까지만 쓴다. 문자열 길이 초과와 `ideas` 개수(코드 판정 대상)는 계속 거부한다.
  - `src/lib/jamjari/prompts.ts`: 개념 프롬프트에 목록 개수 상한을 적었다.
  - `src/lib/jamjari/worker.ts`: 형식 오류 시 어긴 필드 경로와 코드만(값 제외) 오류 메시지와 재시도 기록에 남긴다. 예: `nextAction:too_big`.
- 확인: 시도 2 원본 응답이 이제 스키마를 통과한다. 회귀 테스트 `outputs.test.ts`(목록 상한 4개), `worker.test.ts`(경로 기록 1개) 추가.

### 3.3 유튜브 프레임 0장 (13:43 발견, 13:44 수정)

- 증상: 첫 W5 유튜브 작업 `j_09e833261c0fa5ea`에서 kiro-cli가 장면 시각 6개를 골랐는데 캡처가 0장이었다. sandbox 폴더에 `sub.en.vtt`만 있고 `scene-*.jpg`가 없었다.
- 원인: `youtube.ts` `captureFrames`가 스트림 주소를 `yt-dlp -g -f "best[height<=480][ext=mp4]/best[height<=480]/worst"`로 받는다. yt-dlp 2026.08.19에서 이 영상은 결합 포맷 18이 `--list-formats`에는 나오지만 `-f 18`, `best…`, `worst` 모두 "Requested format is not available"로 실패했다. 주소가 없으니 ffmpeg를 실행하지 않았다.
- 수정: 프레임만 필요하므로 영상 전용 스트림을 먼저 고르게 바꿨다: `bv*[height<=480][ext=mp4]/bv*[height<=480]/wv*/best[height<=480]/worst`.
- 확인: 같은 선택식으로 스트림 주소를 받아 ffmpeg로 0:05 프레임 1장(640×480)을 직접 뽑아 봤다. 워커 재시작(npm pid 20916 / node pid 33668, 로그 `.data/worker6.out.log`) 뒤 같은 영상 재실행에서 6장 캡처. `node scripts/quality.mjs task` PASS(13:47). 이 경로의 자동 테스트는 없다(외부 도구 호출).

### 3.4 휴대폰(다른 기기)에서 담기가 403 (14:18 발견, 14:19 수정)

- 증상: 휴대폰 테스트용으로 `npm.cmd run start -- -p 3001 -H 0.0.0.0`을 띄우고 LAN 주소(`http://172.24.96.178:3001`)로 열었다. 같은 화면에서 `＋ 생각 담기`를 눌렀는데 `403 cross_origin`이 났다.
- 원인: `http.ts` `guard`가 Origin을 `request.url`의 호스트와 비교했다. 이 서버에서 `request.url`은 브라우저가 연 주소가 아니라 바인딩 주소(`0.0.0.0:3001`)를 담았다. localhost로만 쓸 때는 둘이 같아 드러나지 않았다.
- 수정: 브라우저가 보낸 `Host` 헤더와 비교한다(없으면 `request.url`). `x-jamjari` 헤더 요구는 그대로다. 회귀 테스트 1개를 `api.test.ts`에 추가했다(바인딩 주소 + 같은 Origin/Host → 201, 다른 Origin → 403).
- 확인: `quality.mjs task` PASS, `release --force` PASS(14:20:03). 재기동한 3001 서버에 같은 Origin 맡기기 200, 다른 Origin 403. Edge 390×844로 LAN 주소를 열어 샘플 아이디어 담기 → 맡기기 → 12초 안에 브리핑 "맡긴 14개 중 완료 10"(가로 넘침 없음). 결과 주소 4개 LAN에서 200.
- 참고: dev 서버(`next dev`)를 LAN 주소로 열면 HMR 웹소켓과 폰트가 403이다(Next 16의 dev 출처 제한). 휴대폰 테스트는 프로덕션 서버로 한다.

### 3.5 W6 연도 판정이 모델 표시에 의존 (14:29 확인, 14:31 보강)

- 관찰: kiro-cli가 "사용자가 답변으로 2026년이라고 알려 yearStated=true로 두었다"고 썼다. 처음에는 지어낸 답변으로 판단했으나, 작업 기록을 다시 보니 14:28:57에 사용자가 같은 화면에서 답변을 보냈다. **모델 오류가 아니었다**(14:45 정정).
- 보강: 그래도 코드의 연도 판정이 모델의 `yearStated` 표시를 그대로 믿는 구조였다. `schedule.ts` `verifyYearStated`가 날짜의 연도 숫자를 원문·사용자 답변에서 다시 찾고, 없으면 `yearStated=false`로 바꿔 질문하게 했다(모델이 쓴 excerpt는 근거로 쓰지 않음). 단위 테스트 3개.

### 3.6 질문이 두 번 이어지면 앞선 답이 사라짐 (14:35 발견, 14:37 수정)

- 증상: 위 작업에서 시각을 답한 뒤 연도를 묻고, 연도를 답하자 다시 시각을 물었다. 새 질문이 생길 때 이전 답이 지워졌다.
- 수정: `job.ts` `answers`(최근 5개 질문·답)와 `answersText`. `service.ts`가 답을 누적하고 `worker.ts`가 전부 엔진과 연도 확인에 넘긴다. 워커 테스트 1개(시각 답 → 연도 질문 → 연도 답 → 세 번째 호출에 두 답 모두 포함).
- 확인: 워커 재시작(14:39, 로그 `.data/worker8.out.log`) 뒤 같은 작업에 화면에서 시각 답 → 연도 질문 → 연도 답 → `awaiting_external_action`(14:40:47).

### 3.7 입력 단계 실패에도 "kiro-cli 실제 생성" 배지

- 증상: W5 오류 2건은 엔진을 부르지 않았는데 결과의 `engine`이 `kiro-cli`였다.
- 수정: 입력 수집 단계에서 실패하면 `engine: code`(화면 배지 "코드"). 테스트 2곳에 확인 추가.

### 3.8 `npm.cmd run worker`가 `.env.local`을 읽지 않음 (16:01 발견, 16:14 수정)

- 증상: Next 서버는 `.env.local`을 읽어 연결 상태에 "토큰 설정됨"을 보이지만, 워커는 `node`로 직접 실행돼 `NOTION_TOKEN`·`GOOGLE_CALENDAR_*`가 없다. 이 상태로 맡기면 Notion `not_configured`, Calendar "연결 없음"으로 끝난다(화면과 워커 판정 불일치).
- 수정: `package.json` `worker` 스크립트에 `--env-file-if-exists=.env.local`(Node 22.19, 파일이 없어도 계속 실행). `quality.mjs task` PASS(16:14).

### 3.9 kiro-cli "캘린더 확인"이 로그인을 끝내지 못함 (16:13·16:15 실패, 16:25 수정)

- 증상: kiro 대화에서 Google 공식 Calendar MCP(`calendarmcp.googleapis.com/mcp/v1`)를 부르면 브라우저 동의 뒤 실패하거나 "MCP connection closed before sign-in"으로 끝났다.
- 원인 1(16:13, `~/.kiro/logs/…/mcp.log`): Google 동의와 콜백은 성공했으나 토큰 교환이 `400 invalid_request`. kiro-cli 3.3.0의 MCP `oauth` 설정은 `clientId`·`redirectUri`·`clientMetadataUrl`만 읽고 `clientSecret`은 무시한다(설치본 `acp-server.js`에서 확인). Google 토큰 서버는 client secret을 요구하므로 이 버전에서는 몇 번을 다시 해도 끝나지 않는다.
- 원인 2(16:15): 로그인 대기 중에 다른 kiro 세션이 `mcp.json`에서 `google-calendar`를 지워(16:16:18) 연결이 닫혔다.
- 수정: `scripts/calendar-mcp.mjs`(의존성 없는 stdio MCP, 읽기 전용 `list_events`)를 `.kiro/settings/mcp.json`의 `google-calendar`로 등록했다. W6와 같은 `.env.local` refresh token(`scripts/google-auth.mjs`로 발급)으로 Calendar REST를 조회한다. 브라우저 로그인이 필요 없고 토큰은 출력하지 않는다.
- 확인: stdio 직접 호출로 11/14–12/1 일정 6건(W6 일정 1건 `[잠자리채]` 표시), 잘못된 날짜는 `isError`. `kiro-cli chat --v3 --no-interactive --trust-tools=@google-calendar` 16초 exit 0, 도구 호출 후 6건 답변(16:24). 신뢰 옵션 없는 비대화형 실행은 권한 승인 불가로 거부됐다(`autoApprove` 미적용). 대화형에서는 처음 한 번 승인이 필요하다. 대화형 화면에서 직접 확인하지는 않았다.

## 4. 재시작 복구 실증 (R2.3, R2.4)

`j_ffefff1abb396176` 기록(UTC):

```
04:05:15 담고 바로 맡김
04:05:16 실행 시작(시도 1)            ← ingest 단계 done(04:05:17)
04:05:25 워커 강제 종료(pid 18624)     ← kiro-cli research 실행 중
04:06:23 워커 중단 감지 → 체크포인트부터 재개(시도 2)   ← 새 워커 pid 30340, lease 60초 만료 뒤
04:07:29 재시도 예약(invalid_output, 60초 뒤)
04:08:29 실행 시작(시도 3)
04:09:23 completed
```

`steps.ingest.at`이 04:05:17로 남아 있어 재개 뒤 ingest를 다시 실행하지 않았다. research 단계는 끝나기 전에 워커가 죽어 체크포인트가 없으므로 다시 실행했다(설계대로).

## 5. 실행하지 않은 것

- W2 영상: kiro-cli 실제 조사 → 렌더는 16:04–16:09에 1건 확인(6절). 렌더 실패 시 부분 완료 처리는 코드 테스트로만 확인.
- W5 유튜브: 요약까지 간 영상은 19초짜리 1개뿐이다. 20분 초과·없는 영상 거부는 14:29 실제 확인, 자막 없음은 자동 테스트만.
- W6 실제 Calendar 등록: 16:10에 1건 확인(6절). 이미지·URL만으로 된 일정 입력은 확인하지 않았다(이미지 분석 미연결).
- Google 로그인: 연결 정보 없음.

## 6. 6경로 실연동 점검 (16:02–16:13, 화면에서 담기 → 바로 정리)

워커 `w_ebd64ce4`(pid 32748, `.env.local` 로드, 로그 `.data/worker10.out.log`). Notion 페이지는 앱 토큰으로 REST 조회해 `잠자리채 › 2026-11-14 › {경로} › {작업}` 위치와 블록을 확인했다. Calendar 일정은 Calendar API로 다시 조회했다.

| 경로 | 작업 | 입력 | 결과 | 시간 | Notion |
|---|---|---|---|---|---|
| W1 | `j_7ecaed56c1ab51ab` | 메모 "확산 모델" | completed, HTML(정의·원리·역사 2015–2026·최근 논문 2편·출처 6/6 응답) | 58초 | synced(블록 19) |
| W1 | `j_16211208748b6b3e` | URL(위키백과 RAG) | completed, 본문 20,000자 + 검색 2회, 출처 4/4 | 44초 | synced |
| W1 | `j_d825de979076fe8b` | 사진만 | failed `no_readable_input`(이미지 분석 미연결) | 0초 | not_configured |
| W2 | `j_efb89e3a34396869` | 메모 "확산 모델" | completed, MP4 61초 1920×1080 장면 8개(브라우저 재생·프레임 확인) | 313초 | synced(영상 링크는 Notion에 없음) |
| W3 | `j_bc775c53ccde29af` | 메모 1줄 | completed, 아이디어 5개 HTML | 35초 | synced |
| W4 | `j_0d64fb37fbb322a7` | 메모 "팀 회식 날짜 정하기 투표" | completed, `/p/…` 버튼 클릭 시 득표 1/5→2/5 갱신 확인 | 27초 | synced |
| W5 | `j_fefa7401bb62d4c5` | 유튜브 jNQXAC9IVRw | partial(자막 근거, 프레임 6장·시점 링크 6개) | 40초 | synced |
| W6 | `j_324d93d916dde5c6` | 메모(11/20 19–21시 스터디) | completed, Google Calendar 일정 생성(팝업 1440분 전·0분), htmlLink 반환 | 11초 | synced |
- 16:21 W6 재확인 `j_0b396c93a3034a50`(2026-11-20 15:00–15:30 Asia/Seoul 테스트 일정): 12초 completed. Calendar API 직접 조회로 `confirmed`·시작/종료 시각·알림 0분/1440분, Notion API로 페이지 블록 11개를 확인했다. 확인 뒤 테스트 일정은 삭제(204)하고 Notion 페이지는 보관 처리(archived)했다. 별도 워커 중복 기동은 하나를 종료했다.
- 생성된 체험 페이지의 버튼 자동 클릭 검사: 워커는 하지 않는다. 위 표의 W4 1건만 사람이 브라우저에서 눌러 확인했다.

## 7. Vercel 공개 시연판 (16:25–16:42)

- 주소: https://jamjarichae.vercel.app (프로젝트 `jamjarichae`, `npx vercel@50 deploy --prod`, 런타임 환경변수 `JAMJARI_DATA_DIR=demo-data/jamjarichae`만 설정. Notion·Google 비밀값은 올리지 않음)
- 동작: `http.ts` guard가 Vercel에서 쓰기만 503 `public_demo`로 거부하고 읽기는 허용. `demo-data/jamjarichae`에 6절 결과 7건(사진 실패 건 제외)과 결과물 8개(HTML 7·MP4 1, 4.2MB)를 넣었다. W6 일정 링크(계정 이메일 포함)·Notion 링크는 스냅샷에서 지웠다. 메인 화면 상단에 "공개 시연판 · 결과 보기 전용" 안내, 연결 상태의 영상 렌더는 Vercel에서 `unsupported`.
- 업로드 제외: `.vercelignore` 허용 목록(`src`, `demo-data`, 설정 파일만). 첫 시도는 루트 설치 파일(.exe)까지 599.5MB가 올라가 "File size limit exceeded"로 배포 실패(배포 생성 전 중단), 두 번째는 프레임워크 미지정으로 실패 → `vercel.json` `framework: nextjs`로 해결.
- 확인(로그인 없이, 16:38–16:42): 메인·`/api/jamjari/jobs`(작업 7개)·결과 HTML 6개·W4 체험·`/v/…` MP4 모두 200. 브라우저에서 담기 → "공개 시연판은 결과 보기 전용" 오류 표시, 영상 재생(61초·1920px), W4 버튼 클릭 시 6/19 득표 1/5→2/5.
