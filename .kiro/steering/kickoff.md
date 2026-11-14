---
inclusion: manual
---
# 현장 킥오프 절차 (문제를 받았을 때만 — "kickoff.md 절차대로 진행해")

1. 문제 원문을 `challenge.md`의 "문제 원문"에 그대로 붙여 넣는다(요약·수정 금지).
2. 원문에서 대상 사용자, 핵심 불편, 제공 데이터, 제출 조건·심사 기준을 뽑아 "이번 MVP" 항목을 갱신한다.
3. 가장 짧은 시연 경로(입력 1개 → 결과 1개 → 사람 검토 → 내보내기)를 고르고 기능을 3개 이하로 자른다.
4. requirements/design/tasks를 한 번에 갱신한다(kiro-cli에는 Quick Spec 화면이 없으므로 change-topic 3단계가 대신한다). 미확정 사항은 가정 목록에 적는다.
5. `.kiro/skills/change-topic/SKILL.md` 절차로 도메인 어댑터·fixtures·테스트·화면 문구·시연 대본을 맞춘다.
6. 첫 구현 작업 전에 `node scripts/quality.mjs task`로 기준선을 확인한다.

시간 기준(권장): 원문 정리 10분 → Spec 15분 → 어댑터·테스트 60분 → 화면 30분 → 시연 준비 20분.
