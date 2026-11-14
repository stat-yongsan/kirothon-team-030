export type AiErrorCode =
  | "config"
  | "auth"
  | "rate_limit"
  | "timeout"
  | "upstream"
  | "truncated"
  | "refusal"
  | "invalid_output";

const STATUS: Record<AiErrorCode, number> = {
  config: 503,
  auth: 502,
  rate_limit: 429,
  timeout: 504,
  upstream: 502,
  truncated: 502,
  refusal: 422,
  invalid_output: 502,
};

/** 사용자에게 보여 줄 수 있는 AI 호출 오류. 메시지에 비밀값·입력 원문을 넣지 않는다. */
export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly status: number;

  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.status = STATUS[code];
  }
}
