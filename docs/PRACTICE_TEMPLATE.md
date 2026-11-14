# 연습 템플릿 환경 설명 (잠자리채 이전)

> 2026-11-14 제출 레포 이전 때 README에서 옮긴 내용이다. 잠자리채 MVP와 별개인 해커톤 준비 환경 설명이다.

아래는 이 저장소의 바탕이 된 해커톤 준비 환경(연습 주제: 비교과 결과보고서 검증 도우미) 설명입니다. `src/domain/program-report.ts`, `Workbench`, `.kiro/specs/mvp/`는 연습용으로 그대로 두었습니다.

## 준비 환경 (kiro-cli)

`challenge.md`에 현장 문제를 붙여 넣고 kiro-cli에 "주제 변경 적용"을 요청하면 Spec 세 파일과 주제별 코드만 바꿔 시연까지 이어지도록 준비한 1인용 Next.js 앱입니다.
기본 예제는 **비교과 프로그램 결과보고서 검증 도우미**(CSV 검증·집계 → Claude 초안 → 검토 → Markdown 다운로드)입니다.

- 스택: Next.js 16.4 App Router · TypeScript · Tailwind 4 · npm · Anthropic SDK · Vercel · DB 없음
- **해커톤 당일 순서: [docs/MANUAL.html](docs/MANUAL.html)** (브라우저로 열기) · 상태 기록: [docs/SETUP_STATUS.md](docs/SETUP_STATUS.md) · 연습 문제: [docs/examples/](docs/examples/)

## 1. Windows에서 시작

PowerShell에서 `npm` 대신 `npm.cmd`/`npx.cmd`를 쓰면 실행 정책을 바꾸지 않아도 됩니다.

```powershell
npm.cmd install
Copy-Item .env.example .env.local   # 처음 한 번. 기본 AI_MODE=mock
node scripts/doctor.mjs             # 환경 점검(비밀값 출력 안 함)
npm.cmd run dev                     # http://localhost:3000
```

실제 Claude를 쓰려면 `.env.local`에 `ANTHROPIC_API_KEY`를 넣고 `AI_MODE=live`로 바꾼 뒤 `node scripts/check-api.mjs --live`로 확인합니다(소량 과금). 모델은 `ANTHROPIC_MODEL`(비우면 `claude-opus-5-5`). 키는 채팅·문서·git에 남기지 않습니다.

## 2. 검사 명령

| 명령 | 내용 |
|---|---|
| `npm.cmd run lint` | ESLint |
| `npm.cmd run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm.cmd run test` | Vitest(watch 아님): 집계 검산, CSV 행 번호, AI 응답 검증, API 경계, Markdown |
| `npm.cmd run build` | 프로덕션 빌드 |
| `node scripts/quality.mjs save` | 변경된 `src` 파일만 ESLint (Hook용, 가벼움) |
| `node scripts/quality.mjs task` | 타입 + 테스트. Spec 작업 체크 전 필수 |
| `node scripts/quality.mjs release --force` | lint + 타입 + 테스트 + build |
| `node scripts/quality.mjs verify-status` | 마지막 task 결과가 현재 소스와 일치하는지 |
| `node scripts/check-api.mjs [--live]` | Claude 연결(기본은 mock이면 호출 안 함) |

`quality.mjs`는 모델을 호출하지 않습니다. 성공한 동일 입력만 캐시하고(소스·설정·lockfile 해시), 동시 실행은 lock으로 막으며, 결과·로그는 `.kiro/runs/`(gitignore)에 씁니다. 종료 코드: 0 통과, 1 검사 실패, 3 다른 검사 실행 중(통과 아님), 4 도구·테스트 없음, 5 시간 초과.
검사 뒤 AI가 오류를 읽고 고치는 과정, MCP 작업, 앱의 Claude API 호출은 별도 사용량입니다.

## 3. 현장에서 주제 바꾸기 (kiro-cli)

1. `challenge.md`의 "문제 원문"에 받은 문제를 그대로 붙여 넣습니다.
2. PowerShell에서 `cd D:\kiro` → `kiro-cli --agent builder`로 채팅을 열고 한 문장으로 요청합니다:
   > challenge.md에 새 문제를 넣었어. .kiro/skills/change-topic/SKILL.md 절차로 Spec 세 파일과 구현을 갱신하고 핵심 시연을 검증해.
3. 에이전트가 change-topic 절차대로 Spec 세 파일, `src/domain/<새 주제>.ts`, fixtures, 테스트, `src/domain/current.ts`, 화면 문구, `docs/DEMO.md`를 함께 바꿉니다. 사용자가 여러 파일을 손으로 맞출 필요는 없습니다.

파일을 저장하는 것만으로 모델이 실행되지는 않습니다. 이 구조가 맞는 문제군은 "문서·데이터 입력 → 코드 검증·판정 → Claude 설명·초안 → 사람 검토 → 내보내기"입니다. 다른 형태(실시간 협업, 다중 사용자 등)는 그 사실부터 보고하도록 되어 있습니다.

## 4. kiro-cli에서 쓰는 법 (kiro-cli 3.3, V3 엔진)

| 기능 | 위치 | 사용 |
|---|---|---|
| Spec | `.kiro/specs/mvp/` | CLI에는 IDE의 Quick Spec 화면이 없습니다. change-topic 절차 3단계가 requirements/design/tasks를 한 번에 다시 씁니다 |
| Steering | `.kiro/steering/` | 기본 에이전트와 builder·reviewer·demo-editor가 읽습니다. 킥오프·제출 절차는 "kickoff.md 절차대로 진행해", "ship.md 절차대로 진행해"로 요청 |
| Custom agents | `.kiro/agents/*.json` | `kiro-cli --agent builder`(구현·검사, Hook 포함), `--agent reviewer`(읽기 전용), `--agent demo-editor`(문서). 확인: `kiro-cli agent list` |
| Hooks | `builder.json`의 `hooks` | 파일 쓰기(`PostToolUse` write) → `quality.mjs save`, 응답 끝(`Stop`) → `quality.mjs task`. kiro-cli 3.3.0은 `.kiro/hooks/*.json`을 실행하지 않아 에이전트 안에 둡니다. 기본 에이전트·Kiro Crew에서는 Hook이 없으니 명령을 직접 실행 |
| Skills | `.kiro/skills/` | `/change-topic`, `/verify-mvp`, `/prepare-submission` 또는 "…/SKILL.md 절차로" 자연어 요청 |
| 목표 반복 | — | `/goal --max 3 <RUN_PROMPTS의 요청문>`(기본 5회, 취소 `/goal clear`) |
| Workflows | `.kiro/workflows/` | 채팅에서 `/workflow run` → 레시피 선택(V3 전용). 기본 개발은 단일 세션 |
| MCP | `.kiro/settings/mcp.json` | Playwright(Edge, `@playwright/mcp@0.0.85`). 확인: `kiro-cli mcp list` |
| 데모 Power | `powers/hackathon-demo/` | `kiro-cli powers install D:\kiro\powers\hackathon-demo`(설치됨). "시연 점검"이라고 요청 |
| Figma | 전역 MCP `figma`(`https://mcp.figma.com/mcp`) + builder `tools`의 `@figma` | 아래 6절. 2026-11-13 연결·whoami·`get_design_context` 확인 |

Kiro Crew를 쓸 때: 폴더를 프로젝트 경로(예: `D:\kiro`)로 지정한 채팅에서 요청합니다. 채팅 하단에서 에이전트를 builder로 고를 수 있지만 Kiro Crew에서는 builder의 Hook이 돌지 않고(2026-11-13 확인), Windows에서는 프로젝트 Skill이 자동 로드되지 않습니다 — 요청문에 SKILL.md 경로를 적는 이유입니다.

| 환경 | 사용할 방법 |
|---|---|
| kiro-cli (기본) | `kiro-cli --agent builder` + `/goal --max 3 …` |
| Kiro Crew | 프로젝트 폴더 채팅 + SKILL.md 경로를 적은 요청문 |
| Cloud session (`--cloud`) | 별도 저장소·환경·비밀값 설정 필요. 로컬 서버·파일·로그인이 자동 승계되지 않음 |

## 5. 배포 (Vercel)

1. 계정·scope 확인: `npx.cmd vercel@latest whoami`가 `statyongsanstat-8277`(해커톤 gmail 계정, Hobby 무료)인지 확인합니다. 다르면 `npx.cmd vercel@latest logout` → `login`(브라우저 승인)으로 바꿉니다.
2. 프로젝트 연결: `npx.cmd vercel@latest link`(GitHub 연동 없이 가장 간단). 대시보드 Import를 쓰려면 Vercel에 GitHub `stat-yongsan`을 먼저 연결해야 합니다(저장소 `stat-yongsan/kirothon-2026`, Private).
3. 환경변수: Settings → Environment Variables에 `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `AI_MODE`, `DRAFT_ACCESS_CODE`를 **Preview와 Production을 구분**해 넣습니다. `NEXT_PUBLIC_` 접두사 금지.
4. 배포 전 `node scripts/quality.mjs release --force` → Preview 배포 `npx.cmd vercel@latest` → 배포 URL에서 첫 화면, AI 초안 1회, Markdown 다운로드를 확인합니다.
5. 비용 보호: 배포에서 `AI_MODE=live`이면 `DRAFT_ACCESS_CODE`가 **필수**입니다(없으면 서버가 503으로 거부). 코드를 아는 사람만 실제 Claude를 호출할 수 있고, 처음 초안을 만들 때 화면에 접근 코드 입력칸이 나타납니다. 총비용 상한은 Anthropic Console의 지출 한도(spend limit)로 겁니다 — 앱 메모리 카운터는 서버리스 인스턴스끼리 공유되지 않아 상한이 되지 못합니다. 코드를 공유하고 싶지 않으면 공개 URL은 `AI_MODE=mock`으로 두세요.

## 6. Figma (선택)

Figma 공식 원격 MCP를 kiro-cli에 직접 등록해 씁니다(kiro-cli에서 Figma Power 설치 이름은 확인하지 못함). 개발 도구 연결이므로 앱 이용자에게 Figma 로그인이나 Kiro 설치를 요구하지 않습니다.

1. 등록(1회, 완료됨): `kiro-cli mcp add --name figma --url https://mcp.figma.com/mcp --scope global` → `kiro-cli mcp list`에 `figma`.
2. builder 에이전트 `tools`에 `@figma`가 있어야 builder가 Figma 도구를 봅니다(`.kiro/agents/builder.json`, 완료됨).
3. kiro-cli 채팅 하단에 `figma requires OAuth`가 보이면 **Ctrl+Y** → **학교 계정**으로 허용합니다. GitHub/Vercel 계정으로 바꾸지 않습니다.
4. 계정 확인은 Figma `whoami` 1회로 끝냅니다(2026-11-13: 학교 계정, student 플랜, **View seat** 확인). View seat는 Figma 도구 호출이 월 6회 정도로 제한되므로 당일에는 `get_design_context` 1~2회만 씁니다.
5. 프레임 링크는 레이어 패널에서 **프레임 하나만** 선택해 "선택 항목 링크 복사"로 받고 `challenge.md`의 "Figma 프레임 URL"에 넣습니다. 결과 보고의 `data-name`이 그 프레임 이름인지 확인합니다(`node-id=0-1`은 페이지 전체).
6. Figma 이미지 asset URL은 7일 뒤 만료되므로 코드에 넣지 않습니다. 한도·로그인 문제로 5분 안에 안 되면 기본 UI로 진행합니다.

## 7. 구조

```
challenge.md                  유일한 주제 입력
src/domain/types.ts           공통 어댑터 계약
src/domain/current.ts         활성 주제 연결(한 줄)
src/domain/program-report.ts  기본 예제 어댑터     src/domain/examples/regulation-guide.ts  연습 예제
src/domain/fixtures/          정상·오류·경계값 샘플(손 검산 주석)
src/lib/ai/                   Claude 서버 어댑터(mock/live 분리, 스키마·근거 ID 검증)
src/app/api/draft/route.ts    서버 재계산 + Claude 호출
src/components/               한 페이지 UI(입력 · 검증·집계 · 초안·검토·내보내기)
scripts/                      doctor · quality · check-api
.kiro/                        specs · steering · hooks · agents · skills · workflows · settings
powers/hackathon-demo/        로컬 데모 점검 Power
```

