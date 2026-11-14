# Tasks — 비교과 프로그램 결과보고서 검증 도우미

> 1~6은 Claude Code가 사전 구현하고 2026-11-13에 실제 검사로 확인했다(Kiro 작업 실행 기록 아님). 주제가 바뀌면 change-topic 절차가 이 목록을 새로 쓰며, 아래 완료 표시를 새 주제의 완료로 재사용하지 않는다.
> 각 작업은 `node scripts/quality.mjs task`가 PASS를 출력한 뒤에만 체크한다.

- [x] 1. CSV 파서와 실제 행 번호
  - `src/domain/csv.ts`: Papaparse, BOM·CRLF 정규화, 따옴표 쉼표·줄바꿈, 필수 열 확인
  - 검증: `npm.cmd run test -- src/domain/csv.test.ts`
  - _Requirements: 1.3, 1.5_

- [x] 2. 결과보고서 도메인 어댑터와 fixtures
  - `src/domain/program-report.ts`, `src/domain/fixtures/program-report.ts`(정상·오류·경계값)
  - 검증: `npm.cmd run test -- src/domain/program-report.test.ts` (140·115·2,800,000·82.14%, 오류 3·4·5·6행, 계산 불가)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

- [x] 3. Claude 서버 어댑터(mock/live 분리, 스키마·근거 ID 검증)
  - `src/lib/ai/*`
  - 검증: `npm.cmd run test -- src/lib/ai` (잘림·거절·형식 오류·연결 오류·주입 격리)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4. `/api/draft` 경계
  - 서버 재계산, 400/413/422/503 매핑, 로그에 원문 미기록
  - 검증: `npm.cmd run test -- src/app/api/draft/route.test.ts`
  - _Requirements: 2.1, 2.3_

- [x] 5. 한 페이지 UI와 검토·Markdown 다운로드
  - `src/components/*`: 7가지 상태, 섹션 편집, 근거 표시, 검토 후 다운로드
  - 검증: `npm.cmd run dev` 후 브라우저에서 오류 샘플 → 수정 → 정상 → 초안 → 검토 → 다운로드, 390px 확인
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 6. 전체 검사
  - 검증: `node scripts/quality.mjs release --force` (lint + 타입 + 테스트 + build)
  - _Requirements: 전체_

- [ ] 7. 실제 Claude 응답 1회 검증
  - `.env.local`에 키를 넣고 `AI_MODE=live`
  - 검증: `node scripts/check-api.mjs --live` PASS, 화면에서 "실제 AI 응답" 배지와 근거 ID 검증 통과 확인
  - _Requirements: 2.1, 2.2_

- [ ] 8. Vercel Preview 배포 확인
  - 환경변수(Preview/Production 구분) 설정 후 배포, 첫 화면·AI 호출·다운로드 확인
  - 검증: 배포 URL에서 정상 샘플 흐름 1회, `docs/SETUP_STATUS.md` 갱신
  - _Requirements: 2.1, 3.3_
