import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { BackgroundStatus } from "../../../../../shared/types";
import { getBackgroundStatus } from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";

/**
 * Reine Ableitung des GitLab-Sync-Headline-Labels aus dem Status. `now` wird
 * explizit übergeben (testbar, keine versteckte Date.now()-Abhängigkeit).
 */
export function syncLabel(data: BackgroundStatus, now: number): string {
  if (data.syncRunning) return "Sync läuft…";
  const next = data.schedules.find((s) => s.name === "gitlab_sync")?.nextRunAt ?? null;
  if (next === null) return "Sync fällig";
  const diffMs = new Date(next).getTime() - now;
  if (diffMs <= 0) return "Sync fällig";
  const mins = Math.max(1, Math.round(diffMs / 60_000));
  return `Sync in ~${mins} min`;
}

/**
 * Read-only Sidebar-Widget: zeigt, dass Hintergrundprozesse laufen und ihren
 * Stand. Keine Steuerung. Pollt alle 5s (refetchInterval triggert Re-Render,
 * daher reicht `Date.now()` pro Render für die relative Restzeit).
 */
export function BackgroundStatusWidget() {
  const status = useQuery({
    queryKey: keys.backgroundStatus(),
    queryFn: async () => unwrap(await getBackgroundStatus()),
    refetchInterval: 5000,
  });

  const data = status.data;
  // Kein Layout-Sprung während des ersten Ladens.
  if (!data) return null;

  const inProgress = data.queue.pending + data.queue.processing;

  return (
    <div className="border-t border-border px-3 py-2 text-xs">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <RefreshCw className={"h-3 w-3 shrink-0" + (data.syncRunning ? " animate-spin" : "")} />
        <span>{syncLabel(data, Date.now())}</span>
      </div>
      {inProgress > 0 && (
        <div className="mt-1 text-muted-foreground">
          {inProgress} Buchung{inProgress === 1 ? "" : "en"} in Arbeit
        </div>
      )}
      {data.queue.dead > 0 && (
        <Link
          to="/settings"
          className="mt-1 flex items-center gap-1.5 text-danger-solid hover:underline"
        >
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {data.queue.dead} fehlgeschlagen
        </Link>
      )}
    </div>
  );
}
