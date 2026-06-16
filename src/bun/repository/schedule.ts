import type { Database } from "bun:sqlite";

export interface Schedule {
  name: string;
  intervalSec: number;
  lastRun: string | null;
  config: string | null;
}

interface ScheduleRow {
  name: string;
  interval_sec: number;
  last_run: string | null;
  config: string | null;
}

function toSchedule(row: ScheduleRow): Schedule {
  return {
    name: row.name,
    intervalSec: row.interval_sec,
    lastRun: row.last_run,
    config: row.config,
  };
}

export function createScheduleRepository(db: Database) {
  return {
    get(name: string): Schedule | null {
      const row = db
        .query<ScheduleRow, [string]>(
          "SELECT name, interval_sec, last_run, config FROM schedules WHERE name = ?",
        )
        .get(name);
      return row ? toSchedule(row) : null;
    },

    /** Fällige Schedules: noch nie gelaufen oder Intervall seit last_run überschritten. */
    getDue(now: Date = new Date()): Schedule[] {
      const rows = db
        .query<ScheduleRow, []>("SELECT name, interval_sec, last_run, config FROM schedules")
        .all();
      return rows.map(toSchedule).filter((s) => {
        if (!s.lastRun) return true;
        const elapsedSec = (now.getTime() - new Date(s.lastRun).getTime()) / 1000;
        return elapsedSec >= s.intervalSec;
      });
    },

    updateLastRun(name: string, now: Date = new Date()): void {
      db.run("UPDATE schedules SET last_run = ? WHERE name = ?", [now.toISOString(), name]);
    },

    setInterval(name: string, intervalSec: number): void {
      db.run("UPDATE schedules SET interval_sec = ? WHERE name = ?", [intervalSec, name]);
    },
  };
}

export type ScheduleRepository = ReturnType<typeof createScheduleRepository>;
