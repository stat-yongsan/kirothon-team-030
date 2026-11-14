---
inclusion: fileMatch
fileMatchPattern:
  - "src/app/api/**"
  - "src/lib/ai/**"
---
# 서버·AI 코드 규칙

- `ANTHROPIC_API_KEY`는 서버에서만 읽는다. `NEXT_PUBLIC_` 변수, 클라이언트 컴포넌트, 응답 본문, 로그에 넣지 않는다.
- 입력은 zod로 검증하고 크기 상한(100,000자, 근거 300개)을 둔다. 클라이언트가 보낸 집계를 믿지 말고 서버에서 `domain.analyze()`로 다시 계산한다.
- Claude에는 검증된 근거(ID·값·출처)만 보낸다. 사용자 데이터는 `<facts>` JSON 안에 두고 지시로 취급하지 않는다.
- 응답은 `output_config.format`(JSON Schema)으로 받고 zod + 근거 ID 존재 여부로 다시 검증한다.
- live 호출은 접근 코드로 보호한다: 프로덕션에서 `DRAFT_ACCESS_CODE`가 없으면 503, 헤더 `x-access-code` 불일치면 401(비교는 해시 후 `timingSafeEqual`). 총비용 상한은 Anthropic Console 지출 한도.
- 상한: `max_tokens` 12,000, timeout 50초, 재시도 1회, `maxDuration` 120초.
- `stop_reason`이 `max_tokens`/`refusal`이면 오류다. 실패를 mock 결과로 대체하지 않는다.
- SDK 오류는 타입별(`AuthenticationError`, `RateLimitError`, `APIConnectionTimeoutError` …)로 `AiError` 코드에 매핑한다. 문자열 매칭 금지.
- 서버 로그에는 오류 코드와 상태만 남긴다. 입력 원문·개인정보 금지.
- 변경 후 `node scripts/quality.mjs task`.
