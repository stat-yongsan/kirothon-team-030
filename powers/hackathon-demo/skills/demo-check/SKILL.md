---
name: demo-check
description: 해커톤 MVP를 실제로 띄우고 Playwright(Edge)로 시연 흐름(샘플 → 검증 → 초안 → 검토 → 다운로드)을 확인한다. "시연 점검", "demo check" 요청에 사용.
---
# 시연 점검

이 Power는 MCP 서버를 새로 등록하지 않는다. 워크스페이스 `.kiro/settings/mcp.json`에 이미 연결된 `playwright` 서버와 프로젝트 검증 명령을 사용한다.

**입력:** 실행 중인 앱 URL(없으면 직접 띄움), `challenge.md`의 대표 성공 장면.
**출력:** 단계별 PASS/FAIL, 스크린샷 경로, 다운로드 파일 확인 결과.
**종료 조건:** 모든 단계 확인 또는 첫 FAIL 원인 기록.

## 단계

1. `node scripts/quality.mjs task` 결과를 확인한다. FAIL이면 시연 점검 전에 보고하고 멈춘다.
2. 포트를 확인하고 앱을 띄운다: `npm.cmd run build` 후 `npm.cmd run start -- -p 3100`(또는 `npm.cmd run dev`). `AI_MODE`를 기록한다.
3. Playwright 도구로 `http://localhost:<port>`를 연다. 상태 배지(`data-testid="phase"`)가 "초기"인지 본다.
4. 오류 샘플 → "입력 오류"와 오류 행 번호, 초안 버튼 비활성. 경계값 샘플 → "계산 불가".
5. 정상 샘플 → 지표가 fixture 손 검산 값과 같은지. 초안 생성 → mock/live 배지 확인.
6. 검토 체크 → "검토 완료" → 다운로드. 파일 내용에 검토 상태·근거 목록이 있는지 확인한다.
7. 390px로 바꿔 가로 넘침을 확인하고 스크린샷을 남긴다. 결과를 표로 보고한다.

앱 이용자에게 Kiro나 Figma 로그인을 요구하지 않는다. 이 점검은 개발자용이다.
