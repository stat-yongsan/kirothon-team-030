# kiro-cli에서 바로 쓰는 요청문

시작: PowerShell에서 `cd D:\kiro` → `kiro-cli --agent builder` (검사 Hook이 붙은 에이전트). 단계가 바뀌면 `/quit` 후 새로 연다. 아래 요청문은 앞 대화 없이도 통한다.

| 요청 | 모델 | 2026-11-13 리허설 |
|---|---|---|
| 주제 변경 | 기본(auto) | 짧은 요청 + haiku는 절차를 건너뜀. 아래 1~6 지정 문장은 haiku에서도 성공 |
| Figma 카드, 좁은 수정 | `--model claude-haiku-4.5` | 성공(약 1~2 / 0.5 크레딧) |

## 현장 문제를 받았을 때 (주제 변경)

```
.kiro/skills/change-topic/SKILL.md를 먼저 읽고 challenge.md의 새 문제로 주제를 바꿔. 반드시 아래 결과물을 모두 만들어:
1) .kiro/specs/mvp/requirements.md, design.md, tasks.md를 새 주제로 새로 작성(기존 [x] 재사용 금지)
2) src/domain/<새주제>.ts: DomainAdapter 구현(CSV면 parseCsv 재사용), 계산·판정은 코드로, 오류는 실제 행 번호로
3) src/domain/fixtures/<새주제>.ts: 정상·오류·경계값 샘플(손 검산 주석)
4) src/domain/<새주제>.test.ts: 손 검산 상수로 테스트
5) src/domain/current.ts를 새 어댑터로 교체
6) challenge.md의 "이번 MVP" 항목과 docs/DEMO.md 갱신
공통 엔진(src/lib, src/components, src/app/api)은 고치지 마. Figma 호출, dev 서버, 브라우저 확인은 하지 마. AI_MODE=mock 유지, 배포·push·유료 서비스 금지, 서브에이전트 금지. 마지막에 node scripts/quality.mjs task PASS를 확인하고 1~6 각각의 파일 경로와 남은 가정을 보고해.
```

보고 후 `git status --short`로 새 도메인 파일 3개와 `current.ts` 변경을 직접 확인한다. 빠졌으면:

> 보고와 달리 [빠진 것]이 없다. 앞의 결과물 1~6 중 빠진 것만 만들고 공통 엔진(src/lib, src/components, src/app/api)은 고치지 마. node scripts/quality.mjs task PASS 후 1~6 각각의 파일 경로를 보고해.

## 대표 성공 장면의 카드 (Figma)

```
challenge.md의 Figma 프레임 URL로 대표 성공 장면의 화면 요소(예: 카드)를 만들어. Figma 호출은 get_design_context 1회만 하고, 받은 코드의 data-name을 먼저 보고해. 그 이상 필요하면 멈추고 보고해. Figma 이미지 asset URL은 코드에 쓰지 마(7일 뒤 만료).
구현 범위:
1) src/domain/types.ts의 Analysis에 그 요소용 선택 필드 하나 추가
2) 새 주제 어댑터가 그 값을 채움
3) src/components/에 새 컴포넌트를 Figma 디자인(색·글꼴 크기·모서리·간격·배지)대로 Tailwind로 작성
4) AnalysisPanel은 그 값이 있을 때만 표 위에 추가로 보여주고 기존 표와 다른 화면은 그대로 둠
5) 어댑터 테스트에 그 값 테스트 1개 추가
dev 서버와 브라우저 확인은 하지 마. AI_MODE=mock 유지, 서브에이전트 금지. 마지막에 node scripts/quality.mjs task PASS를 확인하고 Figma 호출 횟수, data-name, 바뀐 파일을 보고해.
```

Figma가 안 되면 첫 두 문장을 "Figma 없이 기본 Tailwind 디자인으로 대표 성공 장면의 화면 요소(예: 카드)를 만들어."로 바꾼다.

## 검사는 PASS인데 화면 값이 틀릴 때 (좁은 수정)

> 화면에서 [무엇]이 [기대값]이 아니라 [실제값]으로 나온다. [src/domain/새주제.ts]의 [필드]만 고치고, [src/domain/새주제.test.ts]에 [기대값]인지 확인하는 테스트를 추가해. 다른 파일은 고치지 마. node scripts/quality.mjs task PASS 후 보고해.

## 작업 하나 구현 (목표 반복, 최대 3회)

```
/goal --max 3 challenge.md와 활성 Spec을 읽고 현재 미완료 작업 하나를 구현해. 해당 인수 조건과 타입·테스트를 실제 검사하고(node scripts/quality.mjs task PASS), 통과하면 멈추고 명령과 결과를 남겨. 새 기능을 추가하지 말고, 실패를 샘플 응답으로 숨기지 마.
```

`/goal`은 기본 5회 반복, `/goal clear`로 취소, 실행 중 방향 수정은 Ctrl+S(queue steering).

## 발표 직전

> 새 기능을 멈추고 .kiro/skills/prepare-submission/SKILL.md 절차를 실행해. release 검사와 실제 화면 시연을 확인하고, 3분 대본·제출 파일·Kiro 활용 증거를 정리해. 실패나 mock을 숨기지 말고 지금 고칠 수 있는 핵심 결함만 수정해.

## 메모

- 같은 코드에 이미 통과한 검사는 새 이유 없이 반복하지 않는다(`quality.mjs`가 캐시로 `PASS (cached)` 표시).
- Kiro Crew에서 할 때도 같은 문장을 쓴다. Kiro Crew(Windows)는 프로젝트 Skill을 자동 로드하지 않으므로 SKILL.md 경로를 꼭 적는다.
