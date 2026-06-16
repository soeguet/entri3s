import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Plattformübergreifendes Datenverzeichnis für SQLite, Logs, Backups.
 * Windows: %APPDATA%/entries   ·   sonst: ~/.config/entries
 *
 * Der Pfad wird als Argument weitergereicht, nie als Global gehalten.
 */
export function resolveDataDir(): string {
  if (process.platform === "win32") {
    const base = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(base, "entries");
  }
  const base = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(base, "entries");
}
