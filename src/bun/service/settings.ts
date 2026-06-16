import type { Database } from "bun:sqlite";
import type { Settings } from "../../shared/types";
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
    setToken(token: string): Promise<void> {
      return setToken(token);
    },
    backup(destPath: string): void {
      backupDatabase(db, destPath);
    },
  };
}

export type SettingsService = ReturnType<typeof createSettingsService>;
