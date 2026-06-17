import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Square } from "lucide-react";
import type { Entry } from "../../../../../shared/types";
import {
  getRunningEntry,
  startEntry,
  stopEntry,
  getTickets,
  getProjects,
  getRecentTickets,
  assignTicket,
  removeTicket,
} from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { Dialog } from "../../components/ui/dialog";
import { TicketPicker } from "./TicketPicker";

/** Millisekunden → "HH:MM:SS". */
function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** Tickt jede Sekunde, solange `active` true ist — für die Live-Anzeige. */
function useTick(active: boolean): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return nowMs;
}

/**
 * Globales Timer-Widget (unten in der Sidebar, auf jeder Route sichtbar).
 * Startet/stoppt den einen laufenden Entry; übersteht App-Neustart, weil der
 * Zustand in SQLite liegt und über `getRunningEntry` geladen wird.
 */
export function RunningTimerWidget() {
  const qc = useQueryClient();
  const running = useQuery({
    queryKey: keys.runningEntry(),
    queryFn: async () => unwrap(await getRunningEntry()),
  });
  const entry = running.data ?? null;
  const nowMs = useTick(entry !== null);

  const tickets = useQuery({
    queryKey: keys.tickets({ status: "active" }),
    queryFn: async () => unwrap(await getTickets({ status: "active" })),
  });
  const projects = useQuery({
    queryKey: keys.projects(),
    queryFn: async () => unwrap(await getProjects()),
  });
  const recent = useQuery({
    queryKey: keys.recentTickets(),
    queryFn: async () => unwrap(await getRecentTickets(8)),
  });

  const [note, setNote] = useState("");
  const [draftTicketId, setDraftTicketId] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);

  function invalidate() {
    qc.invalidateQueries({ queryKey: keys.runningEntry() });
    qc.invalidateQueries({ queryKey: keys.entries() });
  }

  const start = useMutation({
    mutationFn: async () =>
      unwrap(await startEntry({ ticketId: draftTicketId, notes: note.trim() || null })),
    onSuccess: () => {
      setNote("");
      setDraftTicketId(null);
      invalidate();
    },
  });
  const stop = useMutation({
    mutationFn: async (id: number) => unwrap(await stopEntry(id)),
    onSuccess: invalidate,
  });
  const setTicket = useMutation({
    mutationFn: async (args: { entry: Entry; ticketId: number | null }) => {
      for (const tid of args.entry.ticketIds) unwrap(await removeTicket(args.entry.id, tid));
      if (args.ticketId !== null) unwrap(await assignTicket(args.entry.id, args.ticketId));
    },
    onSuccess: invalidate,
  });

  const activeTicketId = entry ? (entry.ticketIds[0] ?? null) : draftTicketId;
  const ticket = (tickets.data ?? []).find((t) => t.id === activeTicketId) ?? null;
  const ticketLabel = ticket ? `#${ticket.gitlabIid} ${ticket.title}` : "Ticket wählen";

  function onPick(id: number | null) {
    if (entry) setTicket.mutate({ entry, ticketId: id });
    else setDraftTicketId(id);
    setPicking(false);
  }

  return (
    <div className="mt-auto border-t border-slate-200 p-3">
      {entry ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span className="font-mono text-lg font-semibold tabular-nums">
              {formatElapsed(nowMs - new Date(entry.date).getTime())}
            </span>
          </div>
          <p className="truncate text-xs text-slate-500">{entry.notes ?? "ohne Notiz"}</p>
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="block w-full truncate rounded border border-slate-200 px-2 py-1 text-left text-xs text-slate-600 hover:bg-slate-50"
          >
            {ticketLabel}
          </button>
          <button
            type="button"
            onClick={() => stop.mutate(entry.id)}
            disabled={stop.isPending}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Square className="h-3.5 w-3.5 fill-current" /> Stop
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") start.mutate();
            }}
            placeholder="Woran arbeitest du?"
            className="h-8 w-full rounded-md border border-slate-300 px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          />
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="block w-full truncate rounded border border-slate-200 px-2 py-1 text-left text-xs text-slate-600 hover:bg-slate-50"
          >
            {ticketLabel}
          </button>
          <button
            type="button"
            onClick={() => start.mutate()}
            disabled={start.isPending}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5 fill-current" /> Start
          </button>
        </div>
      )}

      <Dialog open={picking} onClose={() => setPicking(false)} size="lg">
        <TicketPicker
          tickets={tickets.data ?? []}
          projects={projects.data ?? []}
          recent={recent.data ?? []}
          value={activeTicketId}
          onSelect={onPick}
          onCancel={() => setPicking(false)}
        />
      </Dialog>
    </div>
  );
}
