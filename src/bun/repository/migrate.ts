import { openDatabase } from "./db";
import { resolveDataDir } from "../lib/paths";

// Dev-Hilfsskript: führt Migrationen gegen die echte DB aus (`mise run migrate`).
const dataDir = resolveDataDir();
const db = openDatabase(dataDir);
const journalMode = db.query<{ journal_mode: string }, []>("PRAGMA journal_mode").get();
console.log(
  `Migrations applied. DB at ${dataDir}/entries.db (journal_mode=${journalMode?.journal_mode})`,
);
db.close();
