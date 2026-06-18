import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fromZonedTime } from "date-fns-tz";
import type { EntryFilter } from "../../../../../shared/types";
import { getEntries, getRunningEntry } from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { formatDuration, rangeForPreset } from "../../lib/dates";

const TZ = "Europe/Berlin";
const TARGET_MINUTES = 480;

function todayFilter(): EntryFilter {
  const today = rangeForPreset("today");
  return {
    dateFrom: fromZonedTime(`${today.from}T00:00:00`, TZ).toISOString(),
    dateTo: fromZonedTime(`${today.to}T23:59:59`, TZ).toISOString(),
  };
}

export function DailyProgress() {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const filter = todayFilter();
  const entries = useQuery({
    queryKey: keys.entries(filter),
    queryFn: async () => unwrap(await getEntries(filter)),
  });
  const running = useQuery({
    queryKey: keys.runningEntry(),
    queryFn: async () => unwrap(await getRunningEntry()),
  });

  const settled = (entries.data ?? []).filter((e) => e.status !== "running");
  const settledMinutes = settled.reduce((sum, e) => sum + e.durationMinutes, 0);

  const runningEntry = running.data ?? null;
  const runningMinutes = runningEntry
    ? Math.max(0, Math.floor((nowMs - new Date(runningEntry.date).getTime()) / 60_000))
    : 0;

  const totalMinutes = settledMinutes + runningMinutes;
  const remaining = Math.max(0, TARGET_MINUTES - totalMinutes);
  const pct = Math.min(100, (totalMinutes / TARGET_MINUTES) * 100);

  if (settled.length === 0 && !runningEntry) return null;

  return (
    <div className="border-t border-border px-3 py-2">
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium text-foreground">{formatDuration(totalMinutes)}</span>
        <span className="text-muted-foreground">
          {remaining > 0 ? `noch ${formatDuration(remaining)}` : "Tagesziel erreicht"}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={
            "h-full rounded-full transition-all " +
            (pct >= 100 ? "bg-success-solid" : "bg-primary")
          }
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
