---
inclusion: always
---
# 구조와 변경 경계

| 위치 | 역할 | 주제 변경 시 |
|---|---|---|
| `src/domain/types.ts` | 공통 어댑터 계약(`DomainAdapter`, `Analysis`, `Evidence`) | 유지 |
| `src/domain/csv.ts`, `format.ts` | 공통 CSV 파서·숫자 표기 | 유지 |
| `src/domain/<topic>.ts` | 주제 어댑터: 필드·라벨·검증·집계·근거·프롬프트·샘플 | **새로 작성/수정** |
| `src/domain/fixtures/` | 정상·오류·경계값 샘플 | **새로 작성** |
| `src/domain/current.ts` | 활성 어댑터 한 줄 연결 | **변경** |
| `src/domain/examples/` | 연습 주제 어댑터(공통 엔진 재사용 확인용) | 유지 |
| `src/lib/ai/` | Claude 어댑터, 스키마, mock | AI 출력 구조가 바뀔 때만 |
| `src/lib/report/` | Markdown 내보내기 | 출력 형식이 바뀔 때만 |
| `src/components/`, `src/app/` | 공통 화면·API | 필요한 최소만 |
| `scripts/` | doctor·quality·check-api | 유지 |
| `docs/examples/` | 연습 문제 설명(활성 Spec 아님) | 유지 |

테스트는 대상 파일 옆 `*.test.ts`. 기대값은 손 검산 상수로 쓰고 구현 로직을 복사하지 않는다.
