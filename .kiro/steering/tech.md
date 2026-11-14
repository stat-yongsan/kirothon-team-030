---
inclusion: always
---
# 기술 스택 (고정)

| 항목 | 선택 |
|---|---|
| 실행 환경 | Windows 네이티브, kiro-cli 3.3(V3 엔진), PowerShell(`npm.cmd`/`npx.cmd`), Node 22(워커는 TS 직접 실행) |
| 프레임워크 | Next.js 16.4 App Router + TypeScript + Tailwind 4, `src/` 구조, `cacheComponents` 켬 |
| 패키지 | npm(`package-lock.json`). 매니저 교체 금지 |
| 생성 엔진 | kiro-cli headless(`chat --v3 --no-interactive`), 작업별 빈 폴더, stdin 프롬프트, 경로별 고정 신뢰 도구(W1·W2만 `remote_web_search`, `web_fetch`) |
| 외부 도구 | yt-dlp(메타데이터·자막·스트림 주소), ffmpeg(프레임 캡처). 셸 없이 인자 배열로 실행 |
| 검증 | zod 4(서버 입력·kiro-cli 출력) |
| 테스트 | Vitest 5(`npm.cmd run test`, watch 아님), ESLint 9 CLI, `tsc --noEmit` |
| 저장 | DB 없음. `.data/jamjarichae/` 로컬 파일(원자적 쓰기 + `wx` 잠금). Vercel에서는 큐가 동작하지 않으므로 API가 503을 돌려준다 |

Next 16은 학습 데이터와 다를 수 있다. 낯선 API는 `node_modules/next/dist/docs/`를 먼저 읽는다.
