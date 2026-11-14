---
name: verify-mvp
description: 현재 MVP의 핵심 사용자 흐름(정상·오류·경계값·API 실패·검토·다운로드)을 실제 실행으로 확인한다. "MVP 검증", "verify-mvp", "핵심 흐름 확인" 요청에 사용.
---
# 핵심 흐름 검증

**입력:** 현재 코드, `challenge.md`의 대표 성공 장면, 활성 Spec 인수 조건.
**출력:** 항목별 PASS/FAIL 표(명령·관찰 결과), 실패 시 재현 절차. `docs/SETUP_STATUS.md`의 해당 행 갱신.
**종료 조건:** 모든 항목 확인 또는 FAIL 원인 기록. 실행하지 못한 항목은 CHECK_REQUIRED로 남긴다.

## 단계

1. `node scripts/quality.mjs task` 실행, 출력 첫 줄 기록.
2. 포트 확인 후 `npm.cmd run dev`(또는 `npm.cmd run build` 후 `npm.cmd run start`)로 앱을 띄운다. `.env.local`의 `AI_MODE`를 기록한다.
3. Playwright(Edge)로 실제 URL을 연다. 오류 샘플 → "입력 오류", 오류 행 번호가 fixture 주석과 일치하는지, 초안 버튼 비활성.
4. 경계값 샘플 → 0 분모 항목이 "계산 불가"(Infinity·NaN·0% 아님). 정상 샘플 → 지표가 fixture 손 검산 값과 일치.
5. 초안 생성 → mock이면 "샘플 응답", live면 "실제 AI 응답 · 모델" 배지. 각 섹션에 근거 ID가 표시되는지.
6. 섹션 편집 → 검토 체크 → "검토 완료" → Markdown 다운로드. 파일에 검토 상태·모드·편집 문장·근거 목록이 있는지 읽어 확인.
7. API 실패: `AI_MODE=live`, 키 없이 서버를 띄워 "API 오류"와 원인 코드가 보이고 샘플로 대체되지 않는지 확인.
8. 390px·1440px에서 가로 넘침과 버튼 가림 확인. 결과 표를 보고하고 SETUP_STATUS를 갱신한다.
