import type { AppError } from "../../shared/types";
import { AppErrorError } from "../lib/app-error";

/** Mappt beliebige Exceptions auf einen AppError für die RPC-Response. */
export function toAppError(e: unknown): AppError {
  if (e instanceof AppErrorError) return e.toAppError();
  if (e instanceof Error) return { code: "INTERNAL", message: e.message, retry: false };
  return { code: "INTERNAL", message: String(e), retry: false };
}
