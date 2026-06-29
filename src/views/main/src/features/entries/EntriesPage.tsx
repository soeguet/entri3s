import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fromZonedTime } from "date-fns-tz";
import type { Entry, EntryFilter } from "../../../../../shared/types";
import {
  getEntries,
  getTickets,
  getProjects,
  getTags,
  deleteEntry,
  bookEntry,
  resumeEntry,
  getRunningEntry,
} from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { formatDuration, shiftDay, singleDayBase, todayBerlinYmd } from "../../lib/dates";
import { useHotkey } from "../../lib/useHotkey";
import { useCommands } from "../../lib/useCommand";
import { buildFilterTree, resolveSelection } from "../../lib/filterTree";
import { PageHeader } from "../../components/PageHeader";
import { ErrorNote } from "../../components/ErrorNote";
import { Button } from "../../components/ui/button";
import { EntryList } from "./EntryList";
import { EntryForm } from "./EntryForm";
import { EntryQuickEditDialog, type QuickEditField } from "./EntryQuickEditDialog";
import { EntriesFilters } from "./EntriesFilters";
import { EntriesFiltersCompact } from "./EntriesFiltersCompact";
import { loadCollapsed, saveCollapsed } from "./filterPrefs";
import { useEntriesFilters } from "./useEntriesFilters";
import { DayNavigator } from "./DayNavigator";
import { GapBanner } from "./GapBanner";
import { EntrySearchDialog } from "./EntrySearchDialog";

const TZ = "Europe/Berlin";

function dayStart(date: string): string {
  return fromZonedTime(`${date}T00:00:00`, TZ).toISOString();
}
function dayEnd(date: string): string {
  return fromZonedTime(`${date}T23:59:59`, TZ).toISOString();
}

export function EntriesPage() {
  const qc = useQueryClient();
  const filters = useEntriesFilters();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | undefined>(undefined);
  const [duplicating, setDuplicating] = useState<Entry | undefined>(undefined);
  const [collapsed, setCollapsedState] = useState(() => loadCollapsed());
  function setCollapsed(value: boolean) {
    setCollapsedState(value);
    saveCollapsed(value);
  }
  const [quickEdit, setQuickEdit] = useState<{
    entry: Entry;
    field: QuickEditField;
    anchor: HTMLElement;
    anchorRect: DOMRect;
  } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const tickets = useQuery({
    queryKey: keys.tickets(),
    queryFn: async () => unwrap(await getTickets({})),
  });
  const projects = useQuery({
    queryKey: keys.projects(),
    queryFn: async () => unwrap(await getProjects()),
  });
  const tags = useQuery({ queryKey: keys.tags(), queryFn: async () => unwrap(await getTags()) });
  // Ungefiltertes Universum aller Entries — nur daraus leiten wir ab, welche
  // Tickets überhaupt zugewiesen sind. (Unabhängig vom aktiven Filter, damit der
  // Picker beim Filtern nicht schrumpft.)
  const allEntries = useQuery({
    queryKey: keys.entries({}),
    queryFn: async () => unwrap(await getEntries({})),
  });

  // Baum nur aus Tickets bauen, die tatsächlich an Entries hängen — plus deren
  // Projekte/Gruppen. So zeigt der Filter nur, wonach es etwas zu filtern gibt.
  const usedTicketIds = new Set((allEntries.data ?? []).flatMap((e) => e.ticketIds));
  const usedTickets = (tickets.data ?? []).filter((t) => usedTicketIds.has(t.id));
  const usedProjectIds = new Set(usedTickets.map((t) => t.projectId));
  const usedProjects = (projects.data ?? []).filter((p) => usedProjectIds.has(p.id));

  const tree = buildFilterTree(usedProjects, usedTickets);
  const { projectIds, ticketIds } = resolveSelection(tree, filters.selectedNodes);

  const filter: EntryFilter = {};
  if (filters.status) filter.status = filters.status;
  if (filters.from) filter.dateFrom = dayStart(filters.from);
  if (filters.to) filter.dateTo = dayEnd(filters.to);
  if (filters.selectedTagIds.length) filter.tagIds = filters.selectedTagIds;
  if (projectIds.length) filter.projectIds = projectIds;
  if (ticketIds.length) filter.ticketIds = ticketIds;

  const entries = useQuery({
    queryKey: keys.entries(filter),
    queryFn: async () => unwrap(await getEntries(filter)),
  });
  // Laufenden Timer kennen, um "Fortsetzen" zu sperren, solange einer läuft.
  // react-query dedupt das mit dem RunningTimerWidget (gleicher Query-Key).
  const running = useQuery({
    queryKey: keys.runningEntry(),
    queryFn: async () => unwrap(await getRunningEntry()),
  });
  const timerRunning = running.data != null;

  const ticketsById = new Map((tickets.data ?? []).map((t) => [t.id, t]));
  const tagsById = new Map((tags.data ?? []).map((t) => [t.id, t]));
  // Der laufende Entry wird im globalen Timer-Widget gezeigt, nicht in der Tabelle.
  const visible = (entries.data ?? []).filter((e) => e.status !== "running");
  const totalMinutes = visible.reduce((sum, e) => sum + e.durationMinutes, 0);

  const remove = useMutation({
    mutationFn: async (id: number) => unwrap(await deleteEntry(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.entries() }),
    meta: { successToast: "Entry gelöscht" },
  });
  const book = useMutation({
    mutationFn: async (id: number) => unwrap(await bookEntry(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.entries() }),
    meta: { successToast: "Zur Buchung eingereiht" },
  });
  const resume = useMutation({
    mutationFn: async (id: number) => unwrap(await resumeEntry(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.runningEntry() });
      qc.invalidateQueries({ queryKey: keys.entries() });
    },
    meta: { successToast: "Timer fortgesetzt" },
  });

  function openCreate() {
    setEditing(undefined);
    setDuplicating(undefined);
    setFormOpen(true);
  }
  function openEdit(entry: Entry) {
    setEditing(entry);
    setDuplicating(undefined);
    setFormOpen(true);
  }
  function openDuplicate(entry: Entry) {
    setEditing(undefined);
    setDuplicating(entry);
    setFormOpen(true);
  }
  function goDay(delta: number) {
    filters.onDay(shiftDay(singleDayBase(filters.from, filters.to, todayBerlinYmd()), delta));
  }
  useHotkey("n", openCreate);
  useHotkey(",", () => goDay(-1));
  useHotkey(".", () => goDay(+1));
  useHotkey("t", () => filters.onDay(todayBerlinYmd()));
  useHotkey("f", () => setSearchOpen(true));
  // mod+shift+f öffnet hier die Entries-Suche. Der globale Ticket-Such-Launcher
  // deaktiviert seine gleiche Kombination auf /entries, damit diese Bindung gewinnt.
  useHotkey("mod+shift+f", () => setSearchOpen(true));

  useCommands([
    { id: "entries:create", label: "Neuer Entry", section: "Entries", run: openCreate },
    {
      id: "entries:today",
      label: "Heute",
      section: "Entries",
      run: () => filters.onDay(todayBerlinYmd()),
    },
    {
      id: "entries:clear-filter",
      label: "Filter zurücksetzen",
      section: "Entries",
      run: filters.clearRange,
    },
    {
      id: "entries:prev-day",
      label: "Vorheriger Tag",
      section: "Entries",
      run: () => goDay(-1),
    },
    {
      id: "entries:next-day",
      label: "Nächster Tag",
      section: "Entries",
      run: () => goDay(+1),
    },
    {
      id: "entries:search",
      label: "Entry suchen",
      keywords: "find suche",
      section: "Entries",
      run: () => setSearchOpen(true),
    },
  ]);

  function confirmDelete(entry: Entry) {
    if (window.confirm(`Entry #${entry.id} löschen?`)) remove.mutate(entry.id);
  }

  const filteredDay = filters.from && filters.from === filters.to ? filters.from : undefined;

  return (
    <div>
      <PageHeader
        title="Entries"
        description="Arbeitszeiten erfassen und buchen"
        actions={<Button onClick={openCreate}>Neuer Entry</Button>}
      />

      <div className="flex gap-6">
        {collapsed ? (
          <EntriesFiltersCompact
            status={filters.status}
            onStatus={filters.setStatus}
            activePreset={filters.activePreset}
            onPreset={filters.applyPreset}
            selectedTagIds={filters.selectedTagIds}
            onToggleTag={filters.toggleTag}
            from={filters.from}
            to={filters.to}
            onClearRange={filters.clearRange}
            selectedNodes={filters.selectedNodes}
            onClearNodes={() => filters.setSelectedNodes(new Set())}
            onExpand={() => setCollapsed(false)}
          />
        ) : (
          <EntriesFilters
            status={filters.status}
            onStatus={filters.setStatus}
            from={filters.from}
            to={filters.to}
            activePreset={filters.activePreset}
            onPreset={filters.applyPreset}
            onFrom={(v) => {
              filters.setFrom(v);
              filters.setActivePreset(null);
            }}
            onTo={(v) => {
              filters.setTo(v);
              filters.setActivePreset(null);
            }}
            onClearRange={filters.clearRange}
            selectedTagIds={filters.selectedTagIds}
            onToggleTag={filters.toggleTag}
            tree={tree}
            selectedNodes={filters.selectedNodes}
            onNodes={filters.setSelectedNodes}
            onCollapse={() => setCollapsed(true)}
          />
        )}

        <div className="min-w-0 flex-1">
          <DayNavigator from={filters.from} to={filters.to} onDay={filters.onDay} />
          <GapBanner />

          {book.isError ? <ErrorNote error={book.error} className="mb-3" /> : null}
          {resume.isError ? <ErrorNote error={resume.error} className="mb-3" /> : null}
          {remove.isError ? <ErrorNote error={remove.error} className="mb-3" /> : null}
          {entries.isError ? <ErrorNote error={entries.error} className="mb-3" /> : null}

          {entries.isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Lädt…</p>
          ) : (
            <>
              {visible.length > 0 ? (
                <p className="mb-2 text-sm text-muted-foreground">
                  {visible.length} {visible.length === 1 ? "Eintrag" : "Einträge"} · Summe{" "}
                  <span className="font-medium text-foreground">
                    {formatDuration(totalMinutes)}
                  </span>
                </p>
              ) : null}
              <EntryList
                entries={visible}
                ticketsById={ticketsById}
                tagsById={tagsById}
                onEdit={openEdit}
                onDelete={confirmDelete}
                onBook={(entry) => book.mutate(entry.id)}
                onResume={(entry) => resume.mutate(entry.id)}
                timerRunning={timerRunning}
                onQuickEdit={(entry, field, anchor) =>
                  setQuickEdit({ entry, field, anchor, anchorRect: anchor.getBoundingClientRect() })
                }
                onDuplicate={openDuplicate}
              />
            </>
          )}
        </div>
      </div>

      {formOpen ? (
        <EntryForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          entry={editing}
          duplicateFrom={duplicating}
          defaultDate={filteredDay}
        />
      ) : null}

      <EntryQuickEditDialog
        entry={quickEdit?.entry ?? null}
        field={quickEdit?.field ?? null}
        anchor={quickEdit?.anchor ?? null}
        anchorRect={quickEdit?.anchorRect ?? null}
        onClose={() => setQuickEdit(null)}
      />

      <EntrySearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        entries={allEntries.data ?? []}
        ticketsById={ticketsById}
        onPick={(entry) => {
          setSearchOpen(false);
          openEdit(entry);
        }}
      />
    </div>
  );
}
