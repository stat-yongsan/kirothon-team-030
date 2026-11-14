const intFormat = new Intl.NumberFormat("ko-KR");

export function formatInt(n: number): string {
  return intFormat.format(n);
}

export function formatWon(n: number): string {
  return `${intFormat.format(n)}원`;
}

/**
 * 비율(%)을 소수 둘째 자리까지. 분모가 0이면 null(계산 불가).
 * Infinity·NaN·임의의 0%를 만들지 않는다.
 */
export function percent(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}

export function formatPercent(value: number | null): string {
  return value === null ? "계산 불가" : `${value.toFixed(2)}%`;
}
