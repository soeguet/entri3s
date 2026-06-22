import type { Database } from "bun:sqlite";
import type { Settings, CurrentUser } from "../../shared/types";

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
        syncIntervalSec: syncIntervalSec(),
        todoFolder: get("todoFolder") ?? "",
      };
    },

    save(settings: Settings): void {
      set("gitlabUrl", settings.gitlabUrl);
      set("todoFolder", settings.todoFolder);
      db.run("UPDATE schedules SET interval_sec = ? WHERE name = ?", [
        settings.syncIntervalSec,
        SYNC_SCHEDULE,
      ]);
    },

    getCurrentUser(): CurrentUser | null {
      const id = get("gitlab_user_id");
      if (id === null) return null;
      const username = get("gitlab_username");
      const name = get("gitlab_user_name");
      return { id: Number(id), username: username ?? "", name: name ?? "" };
    },

    setCurrentUser(user: CurrentUser): void {
      set("gitlab_user_id", String(user.id));
      set("gitlab_username", user.username);
      set("gitlab_user_name", user.name);
    },

    clearCurrentUser(): void {
      db.run("DELETE FROM settings WHERE key IN (?, ?, ?)", [
        "gitlab_user_id",
        "gitlab_username",
        "gitlab_user_name",
      ]);
    },
  };
}

export type SettingsRepository = ReturnType<typeof createSettingsRepository>;
