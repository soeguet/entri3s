import { Database } from "bun:sqlite";
import { runMigrations } from "./db";

/** Frische In-Memory-DB mit vollem Schema + Seed für jeden Test. */
export function createTestDb(): Database {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  runMigrations(db);
  return db;
}
