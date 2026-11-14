---
inclusion: fileMatch
fileMatchPattern:
  - "src/app/**/*.tsx"
  - "src/components/**"
---
# UI 규칙

- 한 페이지: ① 입력 ② 검증·집계 ③ AI 초안·검토·내보내기. 주 동작 버튼은 단계마다 하나.
- 상태를 텍스트로 구분한다: 초기, 샘플 선택, 입력 오류, 분석 중, 결과·미검토, API 오류, 검토 완료. 색만으로 구분하지 않는다.
- mock은 "샘플 응답", live는 "실제 AI 응답 · 모델"을 배지로 표시한다. 검토 전 다운로드 비활성.
- 접근성: 모든 입력에 label, 상태 영역 `role="status"`, 오류 `role="alert"`, 키보드 focus 표시.
- 1440px·390px에서 페이지 가로 넘침 금지. 넓은 표는 자체 `overflow-x-auto` 컨테이너에 둔다.
- 테스트·Playwright용 `data-testid`(phase, sample-*, generate, review-check, download 등)를 유지한다.
- Figma: `challenge.md`에 프레임 URL이 있을 때만 그 프레임을 `get_design_context`로 1회 읽어 색·크기·모서리·간격 위주로 반영한다(계정이 View seat라 월 호출 한도가 있음 — whoami·스크린샷은 필요할 때만). 받은 `data-name`을 보고하고, 이미지 asset URL은 코드에 넣지 않는다(7일 뒤 만료). 반환 코드는 현재 구조·타입·접근성에 맞게 고친다. URL이 없거나 한도면 기본 UI로 진행한다.
