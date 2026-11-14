@AGENTS.md

## Claude Code 시작 순서

1. `challenge.md` → `.kiro/specs/mvp/requirements.md` → `design.md` → `tasks.md` 순서로 읽는다.
2. `node scripts/doctor.mjs`로 환경을 확인한다.
3. 문제 원문이 바뀌었으면 `.kiro/skills/change-topic/SKILL.md` 절차를 그대로 따른다.
4. 미완료 작업 하나만 구현하고 `node scripts/quality.mjs task` 결과를 확인한 뒤 체크한다.

kiro-cli 전용 기능(에이전트 Hook, Power, Workflow, /goal)은 Claude Code에서 실행했다고 기록하지 않는다. Claude Code가 만든 Spec 초안은 "Claude Code 작성"으로 구분한다.
