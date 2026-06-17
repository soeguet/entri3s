/**
 * Minimaler strukturierter Logger für den Main Process. Kein externes Framework —
 * `console.log/error` mit ISO-Zeitstempel, Level und Scope reicht (siehe
 * bun-conventions). Optionale Felder werden als Objekt angehängt, damit GitLab-
 * Responses, HTTP-Status und Variablen im Terminal nachvollziehbar sind.
 *
 * Hintergrund: Sync- und Buchungsfehler liefen bislang stumm ins Leere
 * (`emit.syncFailed` ohne jegliches Log) — "null infos". Dieser Logger macht den
 * gesamten GitLab-/Sync-Pfad im Terminal sichtbar.
 */
type LogFields = Record<string, unknown>;

type Level = "info" | "warn" | "error";

function write(level: Level, scope: string, message: string, fields?: LogFields): void {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase().padEnd(5)} ${scope}: ${message}`;
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (fields && Object.keys(fields).length > 0) {
    sink(line, fields);
  } else {
    sink(line);
  }
}

export interface Logger {
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

/** Erzeugt einen Logger mit festem Scope (z. B. "gitlab", "sync", "worker"). */
export function createLogger(scope: string): Logger {
  return {
    info: (message, fields) => write("info", scope, message, fields),
    warn: (message, fields) => write("warn", scope, message, fields),
    error: (message, fields) => write("error", scope, message, fields),
  };
}
