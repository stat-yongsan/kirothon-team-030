# 공통 규칙 (kiro-cli)

잠자리채: 1인 해커톤 MVP. 문제 원문과 범위는 `challenge.completed.md`, 활성 Spec은 `.kiro/specs/jamjarichae/`(requirements → design → tasks)다.
핵심 사용자 1명 · 핵심 흐름 1개(담기 → 맡기기 → 꺼내보기) · 기능 3개 이내. 새 세션은 `docs/HANDOFF_JAMJARICHAE.md`부터 읽는다.
작업 폴더(현재 디렉터리) 밖의 파일은 수정하지 않는다.

## 명령 (Windows PowerShell은 `npm.cmd` 사용)

| 목적 | 명령 |
|---|---|
| 개발 서버 | `npm.cmd run dev` (http://localhost:3000) |
| 야간 워커 | `npm.cmd run worker` (별도 터미널, kiro-cli 3.3 로그인 필요) |
| ESLint | `npm.cmd run lint` |
| 타입 검사 | `npm.cmd run typecheck` |
| 테스트(watch 아님) | `npm.cmd run test` |
| 프로덕션 빌드 | `npm.cmd run build` |
| 변경 파일 가벼운 검사 | `node scripts/quality.mjs save` |
| 작업 완료 검사(타입+테스트) | `node scripts/quality.mjs task` |
| 제출 전 전체 검사 | `node scripts/quality.mjs release --force` |

## 완료 기준

- Spec 작업 체크박스는 `node scripts/quality.mjs task`가 `PASS`를 출력한 뒤에만 `[x]`로 바꾼다. Hook 실패가 자동으로 완료를 취소하지 않으므로 결과를 직접 확인한다.
- 화면을 바꾸면 실제 브라우저에서 해당 흐름을 확인한다.
- 실패·샘플·미검증을 숨기지 않는다. 실행하지 않은 검사를 통과로 쓰지 않는다. 실제 실행 기록은 `docs/integration-status.md`에 남긴다.
- `.kiro/runs/build-status.json`은 `scripts/quality.mjs`만 쓴다. 직접 수정하지 않는다.

## 변경 원칙

- 도메인 규칙은 `src/domain/jamjarichae/`, 저장소·워커·외부 도구는 `src/lib/jamjari/`, API·뷰어는 `src/app/`에 둔다.
- 숫자·날짜·규칙 판정(조합, 입력 날짜, 아이디어 개수, HTML 안전, 일정 모호성, 출처 응답)은 코드가 한다. kiro-cli에는 데이터 블록으로 감싼 입력만 보내 조사·설명·생성을 받는다.
- 엔진 실패를 샘플 결과로 대체하지 않는다. 샘플 모드 결과는 화면과 HTML에 "샘플"로 표시한다. 연결되지 않은 단계는 가짜 URL 없이 상태로 멈춘다.
- 비밀값은 `.env.local`에만 둔다. `NEXT_PUBLIC_`으로 노출하지 않고 로그·문서·채팅에 남기지 않는다.
- 새 의존성·DB·인증·플러그인 구조는 요구사항에 있고 사용자가 지시할 때만 추가한다. Google 로그인(JWT)은 OAuth 비밀값을 받은 뒤 붙인다.
- 원격 push·배포·PR 게시는 사용자가 지시한 경우에만 한다. 제출 원격은 `team`(https://github.com/stat-yongsan/kirothon-team-030, Public, GitHub 계정 stat-yongsan)이고 로컬 `main` → `team/main`만 push한다. 마감 18:00 이후 커밋은 심사에 반영되지 않는다. `origin`(stat-yongsan/kirothon-2026)은 대회 전 연습 레포라 push하지 않으며, 그 이력은 로컬 `kirothon-2026-main` 브랜치에 있다.
- 제출 레포는 공개다. 외부 디자인 참고 이미지·대회 배포 자료처럼 팀이 만들지 않은 파일은 `.git/info/exclude`에 두고 올리지 않는다.
- 커밋 이메일은 GitHub noreply로 설정돼 있다. `git config user.email`을 바꾸거나 개인 이메일을 파일에 쓰지 않는다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
