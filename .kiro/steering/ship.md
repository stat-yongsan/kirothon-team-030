---
inclusion: manual
---
# 시연·제출 직전 절차 ("ship.md 절차대로 진행해")

1. 새 기능 추가를 멈춘다.
2. `node scripts/quality.mjs release --force` → PASS 확인. 실패하면 핵심 결함만 고친다.
3. `node scripts/check-api.mjs --live`로 실제 Claude 응답을 최소 1회 확인한다. 못 했으면 시연에서 "샘플 응답"이라고 말한다.
4. 실제 화면에서 정상·오류·경계값 샘플, 초안, 검토, 다운로드를 1회 실행한다(`verify-mvp` 스킬 또는 `hackathon-demo` Power).
5. `prepare-submission` 스킬로 3분 대본(`docs/DEMO.md`), 제출 파일, Kiro 활용 증거를 정리한다.
6. 배포·push·PR은 사용자가 지시했을 때만 한다. push는 `git push`(origin `stat-yongsan/kirothon-2026`의 `main`)만 하고, 공개 전환(`gh repo edit --visibility public`)도 사용자가 지시할 때만 한다. 배포했다면 배포 URL에서 첫 화면·AI 호출·다운로드를 다시 확인한다.
