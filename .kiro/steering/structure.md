---
inclusion: always
---
# 구조와 변경 경계

| 위치 | 역할 |
|---|---|
| `src/domain/jamjarichae/` | 계약(6경로·조합 검증·입력 날짜), Job/Result 타입, 출력 스키마·코드 검사, 일정 판정, 브리핑 집계, 보고서 렌더, 샘플 |
| `src/lib/jamjari/` | 파일 저장소(잠금·lease·심장박동), kiro-cli 실행, 프롬프트, URL 수집기(SSRF 차단), 유튜브(yt-dlp·ffmpeg), 워커 `processJob`, 연결 상태, HTTP 가드 |
| `src/app/api/jamjari/` | 담기·맡기기·답변·취소 API |
| `src/app/r/[id]`, `src/app/p/[id]` | 보고서 뷰어(CSP), 체험 페이지(sandbox iframe) |
| `src/components/jamjari/JamjariApp.tsx` | 한 페이지 UI |
| `scripts/jamjari-worker.ts` | 워커 루프 |
| `scripts/quality.mjs` | save·task·release 검사 |
| `.data/jamjarichae/` | 작업·결과물·업로드(git 제외) |

테스트는 대상 파일 옆 `*.test.ts`. 기대값은 손 검산 상수로 쓰고 구현 로직을 복사하지 않는다. 외부 도구(kiro-cli, yt-dlp)는 테스트에서 가짜 의존성으로 바꾼다.
