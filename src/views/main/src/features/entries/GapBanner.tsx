import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fromZonedTime } from "date-fns-tz";
import { AlertTriangle } from "lucide-react";
import type { EntryFilter } from "../../../../../shared/types";
import { getEntries, getRunningEntry, startEntry } from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { formatTime, formatDuration, rangeForPreset } from "../../lib/dates";

const TZ = "Europe/Berlin";

/** Ende eines Entries (date + Dauer) als Millisekunden seit Epoch. */
function endMs(date: string, durationMinutes: number): number {
  return new Date(date).getTime() + durationMinutes * 60_000;
}

/**
 * Zeigt die ungebuchte Zeit seit dem Ende des letzten Entries von heute an und
 * bietet „Lücke füllen & weiter" — startet einen Timer gapfrei zu dieser Endzeit.
 * Erscheint nur, wenn gerade kein Timer läuft und eine Lücke existiert.
 */
export function GapBanner() {
  const qc = useQueryClient();
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const today = rangeForPreset("today");
  const filter: EntryFilter = {
    dateFrom: fromZonedTime(`${today.from}T00:00:00`, TZ).toISOString(),
    dateTo: fromZonedTime(`${today.to}T23:59:59`, TZ).toISOString(),
  };
  const entries = useQuery({
    queryKey: keys.entries(filter),
    queryFn: async () => unwrap(await getEntries(filter)),
  });
  const running = useQuery({
    queryKey: keys.runningEntry(),
    queryFn: async () => unwrap(await getRunningEntry()),
  });

  const fill = useMutation({
    mutationFn: async (startAt: string) =>
      unwrap(await startEntry({ ticketId: null, notes: null, startAt })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.runningEntry() });
      qc.invalidateQueries({ queryKey: keys.entries() });
    },
    meta: { successToast: "Lücke gefüllt" },
  });

  const settled = (entries.data ?? []).filter((e) => e.status !== "running");
  if (running.data || settled.length === 0) return null;

  const lastEnd = Math.max(...settled.map((e) => endMs(e.date, e.durationMinutes)));
  const gapMinutes = Math.floor((nowMs - lastEnd) / 60_000);
  if (gapMinutes < 1) return null;

  const lastEndIso = new Date(lastEnd).toISOString();
  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-warning-border bg-warning-surface px-4 py-2 text-sm text-warning-accent">
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {formatDuration(gapMinutes)} nicht erfasst seit {formatTime(lastEndIso)}
      </span>
      <button
        type="button"
        onClick={() => fill.mutate(lastEndIso)}
        disabled={fill.isPending}
        className="shrink-0 rounded-md bg-warning-solid px-3 py-1 text-xs font-medium text-warning-solid-foreground hover:bg-warning-solid/90 disabled:opacity-50"
      >
        Lücke füllen &amp; weiter
      </button>
    </div>
  );
}
