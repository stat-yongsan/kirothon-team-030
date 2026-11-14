---
inclusion: always
---
# 기술 스택 (고정)

| 항목 | 선택 |
|---|---|
| 실행 환경 | Windows 네이티브, kiro-cli 3.3(V3 엔진), PowerShell(`npm.cmd`/`npx.cmd`), Node 22 |
| 프레임워크 | Next.js 16.4 App Router + TypeScript + Tailwind 4, `src/` 구조, `cacheComponents` 켬 |
| 패키지 | npm(`package-lock.json`). 매니저 교체 금지 |
| AI | `@anthropic-ai/sdk` 1.8, 서버 Route Handler에서만 호출. 모델은 `ANTHROPIC_MODEL`(기본 `claude-opus-5-5`) |
| 검증 | zod 4(서버 입력·AI 응답), Papaparse 5(CSV) |
| 테스트 | Vitest 5(`npm.cmd run test`, watch 아님), ESLint 9 CLI, `tsc --noEmit` |
| 배포 | Vercel. 환경변수 Preview/Production 구분 |
| DB | 없음. Vercel 서버 파일에 영구 저장하지 않는다 |

Next 16은 학습 데이터와 다를 수 있다. 낯선 API는 `node_modules/next/dist/docs/`를 먼저 읽는다.
