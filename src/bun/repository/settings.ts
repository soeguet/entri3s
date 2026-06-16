import type { Database } from "bun:sqlite";
import type { Settings } from "../../shared/types";

const SYNC_SCHEDULE = "gitlab_sync";

export function createSettingsRepository(db: Database) {
  function get(key: string): string | null {
    const row = db
      .query<{ value: string }, [string]>("SELECT value FROM settings WHERE key = ?")
      .get(key);
    return row ? row.value : null;
  }

  function set(key: string, value: string): void {
    db.run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [key, value],
    );
  }

  function syncIntervalSec(): number {
    const row = db
      .query<{ interval_sec: number }, [string]>(
        "SELECT interval_sec FROM schedules WHERE name = ?",
      )
      .get(SYNC_SCHEDULE);
    return row ? row.interval_sec : 300;
  }

  return {
    get,
    set,

    /** Zusammengesetzte App-Settings; syncIntervalSec stammt aus der schedules-Tabelle. */
    getAll(): Settings {
      return {
        gitlabUrl: get("gitlabUrl") ?? "",
        projectId: Number(get("projectId") ?? "0"),
        syncIntervalSec: syncIntervalSec(),
      };
    },

    save(settings: Settings): void {
      set("gitlabUrl", settings.gitlabUrl);
      set("projectId", String(settings.projectId));
      db.run("UPDATE schedules SET interval_sec = ? WHERE name = ?", [
        settings.syncIntervalSec,
        SYNC_SCHEDULE,
      ]);
    },
  };
}

export type SettingsRepository = ReturnType<typeof createSettingsRepository>;
