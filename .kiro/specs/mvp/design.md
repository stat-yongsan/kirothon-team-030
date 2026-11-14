# Design — 비교과 프로그램 결과보고서 검증 도우미

> 작성: Claude Code 사전 초안(2026-11-13). Kiro Quick Spec 생성물이 아니다.

## 화면 (한 페이지, `src/app/page.tsx` → `src/components/Workbench.tsx`)

| 영역 | 내용 |
|---|---|
| 상태 표시줄 | 현재 상태 배지 + 안내 문장 (`data-testid="phase"`) |
| ① 입력 | 샘플 3종(정상·오류·경계값), CSV 파일 선택(100KB 상한), 붙여넣기·직접 수정 |
| ② 검증·집계 | 오류/주의 목록(행 번호), 지표 카드 5개, 프로그램별 표 |
| ③ AI 초안 | 생성 버튼, mock/live 배지, 미검토/검토 완료 배지, 섹션 편집, 근거 목록, 검토 체크, Markdown 다운로드·미리보기 |

상태: `초기 → 샘플 선택|검증 통과|입력 오류 → 분석 중 → 결과·미검토|API 오류 → 검토 완료`. 입력을 바꾸면 AI 결과는 초기화되고, 진행 중 요청의 응답은 버린다.

## 데이터 흐름

```
CSV 텍스트 ──(클라이언트) domain.analyze()──▶ 오류·지표·표 즉시 표시
     │
     └─POST /api/draft {input}──▶ 서버가 domain.analyze() 재계산(클라이언트 값 불신)
                                   ├─ 오류 있음 → 422 input_invalid
                                   └─ 근거(evidence) → buildPrompt → Claude(구조화 출력)
                                         → validateDraft(스키마 + 근거 ID 존재) → {draft, mode, model}
화면: 편집·검토 → buildMarkdown(domain, analysis, draft, meta) → Blob 다운로드
```

## 도메인 어댑터 (`src/domain/types.ts`의 `DomainAdapter`)

- 주제별: `id`, 문구(`title`, `tagline`, `user`, `input`), `samples`, 순수 함수 `analyze(raw) → Analysis`, `ai.system`/`ai.instruction`, `report.title`/`filename`
- `Analysis`: `issues`(행 번호·필드·메시지), `metrics`, `table`, `evidence`(ID·항목·값·출처), `canDraft`
- 활성 주제 연결: `src/domain/current.ts` 한 줄. 기본 예제 `program-report.ts`, 연습 예제 `examples/regulation-guide.ts`
- CSV는 공통 `src/domain/csv.ts`(Papaparse, BOM·CRLF 정규화, 실제 시작 행 번호)

## Claude 호출 (`src/lib/ai/`)

| 파일 | 역할 |
|---|---|
| `config.ts` | `AI_MODE`(mock/live, 그 외 값은 config 오류), `ANTHROPIC_MODEL`(기본 `claude-opus-5-5`), 키 유무 |
| `prompt.ts` | 도메인 지침 + 공통 규칙. 사용자 데이터는 `<facts>` JSON 안에만 둔다 |
| `anthropic.ts` | `@anthropic-ai/sdk` `beta.messages.create`, `output_config.format`(JSON Schema), effort medium, `max_tokens` 12,000, timeout 50초, 재시도 1회, 지원 모델은 `fallbacks: "default"` |
| `schema.ts` | zod 스키마(`summary`, `sections[heading, body, evidenceIds]`, `cautions`) + 근거 ID 검증 |
| `mock.ts` | 근거를 그대로 옮긴 고정 샘플. `[샘플 응답]` 표기 |
| `index.ts` | `generateDraft`: mock이면 샘플, live면 실제 호출. 실패 시 mock 대체 없음 |

## 오류 처리

| 상황 | 서버 응답 | 화면 |
|---|---|---|
| 본문 형식 오류 / 빈 입력 | 400 `bad_request` | API 오류 |
| 100,000자 초과, 근거 300개 초과 | 413 `too_large` | API 오류 |
| 입력 검증 오류 | 422 `input_invalid` | (버튼 비활성으로 사전 차단) |
| 키 없음, 잘못된 AI_MODE, 모델 없음, 배포 live인데 `DRAFT_ACCESS_CODE` 없음 | 503 `config` | API 오류 + 코드 |
| live 모드에서 `x-access-code` 헤더 없음·불일치 | 401 `access_denied` | API 오류 + 접근 코드 입력칸 |
| 인증 실패 / 한도 / 시간 초과 / 연결 실패 | 502 `auth` / 429 `rate_limit` / 504 `timeout` / 502 `upstream` | API 오류 + 코드 |
| `stop_reason=max_tokens` / `refusal` / JSON·스키마·근거 ID 위반 | 502 `truncated` / 422 `refusal` / 502 `invalid_output` | API 오류 + 코드 |

서버 로그에는 오류 코드와 상태만 남긴다(입력 원문·키 없음). `maxDuration = 120`.

## 테스트 전략 (`npm.cmd run test`)

- `csv.test.ts`: 따옴표 쉼표, 빈 줄·여러 줄 필드 행 번호, 닫히지 않은 따옴표
- `program-report.test.ts`: 손 검산 상수(140·115·2,800,000·82.14%)와 비교, 오류 4종 행 번호, 신청자 0
- `examples/regulation-guide.test.ts`: 7일 경계, 50만원 경계, 날짜 오류
- `lib/ai/ai.test.ts`: 근거 ID 위반, 프롬프트 주입 격리, live 성공·잘림·거절·형식 오류·연결 오류(가짜 클라이언트)
- `app/api/draft/route.test.ts`: mock 200, 입력 오류 422, live 키 없음 503(mock 대체 없음), 400/413
- `lib/report/markdown.test.ts`: 모드·검토 상태·근거·표 이스케이프
