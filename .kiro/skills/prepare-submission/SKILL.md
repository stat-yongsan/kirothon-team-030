---
name: prepare-submission
description: 발표 직전 새 기능을 멈추고 release 검사, 실제 화면 시연 확인, 3분 대본, 제출 파일, Kiro 활용 증거를 정리한다. "제출 준비", "prepare-submission", "발표 준비" 요청에 사용.
---
# 제출 준비 절차

**입력:** 현재 코드, `challenge.md`(제출 형식·발표 시간·심사 기준), `.kiro/runs/quality/*`, `docs/SETUP_STATUS.md`.
**출력:** `docs/DEMO.md`(3분 대본), `docs/SUBMISSION.md`(제출 체크리스트·링크·Kiro 활용 증거), 고친 핵심 결함 목록.
**종료 조건:** release PASS와 실제 화면 확인이 기록되거나, 실패 항목이 대본·제출 문서에 그대로 표시됨.

## 단계

1. 새 기능 작업을 멈춘다. 지금 고칠 수 있는 핵심 결함(시연 경로를 막는 것)만 목록으로 만든다.
2. `node scripts/quality.mjs release --force` 실행. FAIL이면 핵심 결함만 고치고 다시 실행한다.
3. `node scripts/check-api.mjs --live`로 실제 응답을 확인한다. 불가하면 대본에 "샘플 응답 시연"을 명시한다.
4. verify-mvp 절차 3~6단계를 실제 화면에서 실행하고 다운로드 파일을 확인한다.
5. `docs/DEMO.md`를 갱신한다: 문제(20초) → 사용자·불편(20초) → 시연(2분: 오류 → 수정 → 집계 → 초안 → 검토 → 다운로드) → Kiro 활용(20초). 실제 확인한 결과만 쓴다.
6. `docs/SUBMISSION.md`에 제출물(저장소/배포 URL/영상 등 현장 안내 기준), 실행 방법, 검사 결과, 알려진 한계를 적는다.
7. Kiro 활용 증거: kiro-cli(또는 Kiro Crew)에서 실제 실행한 세션, Hook 실행 기록(`.kiro/runs/quality/last-*.json`의 hook 표시), Power·MCP 사용 화면만 적는다. Claude Code가 만든 파일은 "사전 준비(Claude Code)"로 구분한다.
8. 배포·push·PR은 사용자가 지시한 경우에만 하고(push는 origin `stat-yongsan/kirothon-2026`의 `main`만), 했다면 배포 URL에서 첫 화면·AI 호출·다운로드를 다시 확인한다.
