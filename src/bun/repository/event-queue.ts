import type { Database } from "bun:sqlite";
import type { AppEvent, AppEventStatus } from "../../shared/types";

export interface ClaimedEvent {
  id: number;
  type: string;
  payload: string;
  retries: number;
}

interface AppEventRow {
  id: number;
  type: string;
  status: AppEvent["status"];
  error: string | null;
  created_at: string;
}

const MAX_RETRIES = 3;

export function createEventQueueRepository(db: Database) {
  return {
    enqueue(type: string, payload: unknown): number {
      const row = db
        .query<{ id: number }, [string, string]>(
          "INSERT INTO event_queue (type, payload) VALUES (?, ?) RETURNING id",
        )
        .get(type, JSON.stringify(payload))!;
      return row.id;
    },

    /** Atomares Claim: pendingstes Event auf 'processing' setzen und zurückgeben. */
    claimNext(): ClaimedEvent | null {
      return (
        db
          .query<ClaimedEvent, []>(
            `UPDATE event_queue SET status = 'processing'
             WHERE id = (
               SELECT id FROM event_queue WHERE status = 'pending' ORDER BY id LIMIT 1
             )
             RETURNING id, type, payload, retries`,
          )
          .get() ?? null
      );
    },

    complete(id: number): void {
      db.run("UPDATE event_queue SET status = 'done', processed_at = ? WHERE id = ?", [
        new Date().toISOString(),
        id,
      ]);
    },

    /**
     * Fehlversuch zählen; ab MAX_RETRIES landet das Event im Dead-Letter.
     * Gibt den neuen Status zurück, damit der Worker beim Dead-Letter den Entry
     * auf einen terminalen Fehlerzustand setzen kann.
     */
    fail(id: number, error: string): AppEventStatus {
      const row = db
        .query<{ status: AppEventStatus }, [string, number]>(
          `UPDATE event_queue
           SET retries = retries + 1,
               status = CASE WHEN retries + 1 >= ${MAX_RETRIES} THEN 'dead' ELSE 'pending' END,
               error = ?
           WHERE id = ?
           RETURNING status`,
        )
        .get(error, id)!;
      return row.status;
    },

    /** Beim Start: hängengebliebene 'processing'-Events zurück auf 'pending'. */
    resetStuck(): void {
      db.run("UPDATE event_queue SET status = 'pending' WHERE status = 'processing'");
    },

    listDead(): AppEvent[] {
      return db
        .query<AppEventRow, []>(
          "SELECT id, type, status, error, created_at FROM event_queue WHERE status = 'dead' ORDER BY id DESC",
        )
        .all()
        .map((r) => ({
          id: r.id,
          type: r.type,
          status: r.status,
          error: r.error,
          createdAt: r.created_at,
        }));
    },

    /** Typ + Payload eines Dead-Letter-Events; für die Retry-Logik im Service. */
    getDeadById(id: number): { type: string; payload: string } | null {
      return (
        db
          .query<{ type: string; payload: string }, [number]>(
            "SELECT type, payload FROM event_queue WHERE id = ? AND status = 'dead'",
          )
          .get(id) ?? null
      );
    },

    retryDead(id: number): void {
      db.run(
        "UPDATE event_queue SET status = 'pending', retries = 0, error = NULL WHERE id = ? AND status = 'dead'",
        [id],
      );
    },
  };
}

export type EventQueueRepository = ReturnType<typeof createEventQueueRepository>;
