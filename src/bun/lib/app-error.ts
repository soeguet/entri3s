import type { AppError } from "../../shared/types";

/**
 * Typisierte Exception, die einen AppError transportiert. Services und der
 * GitLab-Client werfen diese; `toAppError` (app/errors.ts) erkennt sie und
 * mappt sie auf die RPC-Response.
 */
export class AppErrorError extends Error {
  readonly code: string;
  readonly retry: boolean;

  constructor(error: AppError) {
    super(error.message);
    this.name = "AppErrorError";
    this.code = error.code;
    this.retry = error.retry;
  }

  toAppError(): AppError {
    return { code: this.code, message: this.message, retry: this.retry };
  }
}

export function appError(code: string, message: string, retry = false): AppErrorError {
  return new AppErrorError({ code, message, retry });
}
