import type { Database } from "bun:sqlite";
import type { Settings, CurrentUser } from "../../shared/types";
import type { Repository } from "../repository";
import { backupDatabase } from "../repository/db";
import { setToken } from "../keychain/keychain";

export function createSettingsService(repo: Repository, db: Database) {
  return {
    get(): Settings {
      return repo.settings.getAll();
    },
    save(settings: Settings): void {
      repo.settings.save(settings);
    },
    // Der laufende GitLab-Client hält den Token aus der Closure (Startzeitpunkt);
    // ein Token-Wechsel wirkt erst nach Neustart. Clearen sorgt dafür, dass beim
    // nächsten Sync der Current User frisch geladen wird.
    async setToken(token: string): Promise<void> {
      await setToken(token);
      repo.settings.clearCurrentUser();
    },
    getCurrentUser(): CurrentUser | null {
      return repo.settings.getCurrentUser();
    },
    backup(destPath: string): void {
      backupDatabase(db, destPath);
    },
  };
}

export type SettingsService = ReturnType<typeof createSettingsService>;
