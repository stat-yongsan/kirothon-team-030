// 현재 주제 연결 지점. 주제를 바꿀 때는 change-topic 절차(.kiro/skills/change-topic/SKILL.md)로
// 새 어댑터를 만들거나 고친 뒤 아래 한 줄을 바꾼다. 공통 엔진(src/lib, src/components)은 유지한다.
//
// - 기본 예제: programReport (src/domain/program-report.ts)
// - 연습 예제: regulationGuide (src/domain/examples/regulation-guide.ts)
import { programReport } from "./program-report";
import type { DomainAdapter } from "./types";

export const currentDomain: DomainAdapter = programReport;
