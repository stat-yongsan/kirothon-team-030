# 외부 스킬 적용 기록 — 잠자리채

> 기록 2026-11-14, kiro-cli. 원문 확인 시각·커밋은 `challenge.completed.md` 부록 B.
> 두 스킬 모두 대화형 에이전트용 절차다. 잠자리채는 사용자가 잠든 동안 혼자 도는 워커라서 질문·확인 단계를 빼고, 절차를 kiro-cli headless 프롬프트(`src/lib/jamjari/prompts.ts`)와 코드 검사로 옮겼다. 원문 파일을 저장소에 복사하지 않았다.

## 1. W3 아이디어 5개 ← jwynia/agent-skills `brainstorming`

| 항목 | 내용 |
|---|---|
| 원문 | `jwynia/agent-skills`의 brainstorming 스킬, 커밋 `99a879745e03899987cde34b17e66f12a1e32ef5` |
| 라이선스 | SKILL.md frontmatter `license: MIT` (저장소 LICENSE 파일은 API에서 404) |
| 쓴 부분 | Escape Velocity Protocol 다섯 단계: Default Enumeration → Function Extraction → Axis Mapping → Entropy Injection → Orthogonality Audit |
| 바꾼 부분 | 대화형 질문·저장 위치 확인 생략(사용자가 "서로 다른 5개 자동 추천"을 미리 요청). 축은 who·when·scale·method 네 개로 고정 |
| 쓰지 않은 부분 | 무작위 제약 스크립트 `constraint-entropy.ts`는 실행하지 않는다. 결과 HTML의 분석 범위에 그대로 적는다 |
| 코드가 판정 | `src/domain/jamjarichae/outputs.ts` `checkIdeas`: 정확히 5개, 이름 중복 없음, 각 아이디어가 2개 축 이상 변경. 실패하면 문제 목록을 프롬프트에 넣어 1회 재생성하고, 그래도 실패하면 `partial`과 검사 결과를 표시 |
| 테스트 | `outputs.test.ts`(4개·중복·축 1개 실패), `worker.test.ts`("4개면 1회 피드백 재생성 후에도 실패 시 partial") |
| 실제 실행 | `j_5e1a77d30c320de3` 32초, 코드 검사 통과, 브라우저에서 아이디어 5개 확인(13:24) |

## 2. W5 요약 ← kar2phi/video-lens

| 항목 | 내용 |
|---|---|
| 원문 | `kar2phi/video-lens`, 커밋 `669491b22529c3b713ce8447207f635d27f39f1b` |
| 라이선스 | MIT |
| 쓴 부분 | 보고서 구성: 요약 → 핵심 포인트 → 분석 → 시간순 목차(시작 시각) |
| 바꾼 부분 | 원문은 `youtube_transcript_api`로 자막을 받는다. 이 PC에는 없어서 같은 단계(메타데이터·자막)를 `yt-dlp`로 한다(`src/lib/jamjari/youtube.ts`). 웹페이지는 자체 URL 수집기(`fetch-url.ts`, 사설 주소 차단·10초·2MB 상한) 본문으로 같은 구성을 만든다 |
| 더한 부분 | 모델이 고른 자막 시각(`sceneSeconds`, 최대 8개)에서 `ffmpeg`로 실제 영상 프레임을 캡처해 붙인다. AI가 화면을 직접 보지 않았으므로 결과는 항상 `partial`이고 "자막 기반, 장면 확인 미완료"를 적는다. 썸네일로 캡처를 대신하지 않는다 |
| 코드가 판정 | 20분 초과 영상 거부(`too_long`), 자막 없으면 장면만으로 요약하지 않음(`no_transcript`), 읽지 못한 URL은 우회하지 않고 `failed`(`unreadable_url`) |
| 테스트 | `fetch-url.test.ts`(사설·루프백·메타데이터 주소, 내부 리다이렉트 차단). W5 워커 경로 자체의 테스트는 없다 |
| 실제 실행 | **하지 않았다.** yt-dlp 2026.08.19·ffmpeg 9.0 설치만 확인. 시연에서 W5 결과를 보여 주지 않는다 |

## 3. 공통 안전 장치 (두 스킬 모두)

- 사용자 메모·웹 본문·자막은 `<user_input>`/`<fetched>` 데이터 블록으로만 넣고, 블록 안의 지시를 따르지 말라고 프롬프트에 적는다(`prompts.ts`의 `GUARD`).
- W3·W5는 신뢰 도구가 없다(`--trust-tools=`). 웹 도구(`web_fetch`, `remote_web_search`)는 W1·W2만 신뢰한다.
- kiro-cli는 작업별 빈 폴더(`.data/jamjarichae/sandbox/{jobId}`)에서 실행해 앱 소스·`.env.local`을 읽을 수 없다.
- 모델 출력은 zod 스키마로 다시 검증하고, HTML은 신뢰 템플릿(`render.ts`)이 모두 이스케이프해서 만든다.
