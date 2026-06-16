import type { AppError, RpcResponse } from "../../../../shared/types";

export function isAppError(v: unknown): v is AppError {
  return (
    typeof v === "object" &&
    v !== null &&
    "code" in v &&
    "message" in v &&
    typeof (v as AppError).code === "string"
  );
}

/** Error mit erhaltenem AppError-Code, damit Features auf z.B. 'OVERLAP' prüfen können. */
export class RpcError extends Error {
  readonly code: string;
  readonly retry: boolean;
  constructor(error: AppError) {
    super(error.message);
    this.name = "RpcError";
    this.code = error.code;
    this.retry = error.retry;
  }
}

/** Entpackt eine RpcResponse: gibt data zurück oder wirft RpcError. */
export function unwrap<T>(res: RpcResponse<T>): T {
  if (res.error) throw new RpcError(res.error);
  return res.data;
}

export function errorMessage(err: unknown): string {
  if (err instanceof RpcError) return err.message;
  if (isAppError(err)) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}
