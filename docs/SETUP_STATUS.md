# 준비 상태 기록

기록: 2026-11-13, Claude Code(Opus 5.5)가 Windows 11 Pro에서 실제 실행한 결과만 적는다. 계정 이름·로그인 상태는 gitignore된 `docs/local-setup.md`에 있다.

- `PASS`: 명령을 실제로 실행해 기대 결과를 확인함
- `FAIL`: 실행했으나 실패함
- `CHECK_REQUIRED`: 파일·설정은 준비했으나 사람의 로그인·IDE 조작·확인이 필요함
- `SKIPPED`: 지시 전이거나 의도적으로 하지 않음

Kiro 기능은 **파일 작성 / kiro-cli 인식 / 실제 실행**을 따로 적는다. 기준 도구: kiro-cli 3.3.0(V3 엔진). 2026-11-13 kiro-cli 기준으로 전환.

## Kiro 구성 (kiro-cli 기준)

| 항목 | 파일 작성 | kiro-cli 인식 | 실제 실행 | 최소 조치 |
|---|---|---|---|---|
| Agents `.kiro/agents/*.json` | PASS (IDE용 .md → JSON 변환) | PASS: `kiro-cli agent validate` 3개 OK, `agent list`에 Workspace로 표시, Kiro Crew 에이전트 목록에도 표시 | PASS: Kiro Crew(builder, 프로젝트 `test`)로 challenge2 change-topic 10분 37초·7.71 크레딧, kiro-cli headless builder 1회 | — |
| Hooks (builder.json 안) | PASS: `PostToolUse`(write)→save, `Stop`→task | PASS | kiro-cli: PASS (`test/`에서 builder 쓰기 → `save` lint PASS, 종료 → `task` 갱신). Kiro Crew: 실행 안 됨(builder를 골라도 `last-save.json` 없음). `.kiro/hooks/*.json`은 kiro-cli 3.3.0에서 실행되지 않아 삭제 | Kiro Crew에서는 검사 명령을 직접 요청 |
| Steering 7개 | PASS | CHECK_REQUIRED (V3는 always/fileMatch/manual 지원 문서 기준) | — | — |
| Skills 3개 | PASS | CHECK_REQUIRED. Kiro Crew(Windows)는 프로젝트 Skill을 로드하지 않음(게이트웨이 로그) → 요청문에 SKILL.md 경로 명시 | — | — |
| Spec `.kiro/specs/mvp/` | PASS (Claude Code 초안) | — (CLI에는 Quick Spec 화면 없음, change-topic이 대체) | — | — |
| Workflows 3개 | PASS (JSON 문법) | CHECK_REQUIRED (`/workflow run`, V3 대화형 전용) | — | 필요할 때만 |
| MCP Playwright | PASS | PASS: `kiro-cli mcp list`에 playwright 표시 | 부분 PASS (이전 stdio 직접 기동 확인) | — |
| 데모 Power | PASS | PASS: `kiro-cli powers install D:\kiro\powers\hackathon-demo` → Installed | — | — |
| Figma (원격 MCP) | — | PASS: 전역 MCP 등록 + builder `@figma`, OAuth 학교 계정, whoami(View seat), `get_design_context` 1회로 카드 구현(2026-11-13 리허설) | — | README 6절. 월 호출 한도 주의 |

## 템플릿 복구 기록 (2026-11-13)

이전 Kiro Crew 채팅이 프로젝트를 `~\.kiro\crew\workspace`로 둔 채 `D:\kiro` 원본에 challenge2를 적용했다. kiro-cli 세션 스냅샷의 수정 전 파일로 원본(비교과 결과보고서 예제)을 되돌렸다. 그때 상태는 `.kiro/runs/backup-kirocrew-challenge2-20261113/`에 보관. 시연용 복사본은 `test/`(별도 프로젝트, 원본 lint·타입 검사에서 제외).

## 계정·배포

| 항목 | 상태 | 관찰 | 최소 조치 |
|---|---|---|---|
| GitHub 계정 | PASS | 해커톤 계정 `stat-yongsan`(사용자 확인 2026-11-13)을 gh 활성 계정으로 전환. 커밋 이메일은 이 계정의 noreply | `node scripts/doctor.mjs`가 활성 계정·커밋 이메일 확인 |
| Vercel 계정 | PASS | 2026-11-13 `kchmok-art`에서 로그아웃 후 해커톤 gmail 계정 `statyongsanstat-8277`로 로그인(팀 `statyongsanstat-8277s-projects`, hobby) | 배포 전 `npx.cmd vercel@latest whoami` |
| git | PASS | origin `https://github.com/stat-yongsan/kirothon-2026` (Private), `main` push 완료(2026-11-13). 이 저장소만 gh 자격 증명 사용. 이력의 개인 이메일 제거 | 제출 때 `git push`, 공개가 조건이면 `gh repo edit --visibility public` |
| Vercel 배포 | SKIPPED | 배포 지시 전. `.vercel` 연결 없음 | README 5절 절차로 Preview 배포 |

## challenge2 시연 (`test/`, 2026-11-13)

| 항목 | 상태 | 관찰 |
|---|---|---|
| 주제 변경 | PASS | Kiro Crew + builder가 Spec 3개·`job-choice` 어댑터·fixtures·테스트 21개·Workbench 폼·DEMO.md 갱신. 원본 `D:\kiro` 변경 없음 |
| 전체 검사 | PASS | `test/`에서 `quality.mjs release --force` (lint·타입·테스트·빌드) |
| 화면 흐름(mock) | PASS | localhost:3005: 오류 샘플 → 오류 1건·초안 잠김, 정상 샘플 → 12개 직무 점수표(1위 데이터 분석가), mock 초안 배지, 검토 후 `job-choice.md` 다운로드 |
| 대표 성공 장면 "직무 카드 3장" | FAIL(부분) | 상위 3개는 점수표·초안 근거(JOB-01~03)로만 표시, 카드 UI는 없음 |
| 실제 Claude 응답 | CHECK_REQUIRED | 키 없음, mock만 |
