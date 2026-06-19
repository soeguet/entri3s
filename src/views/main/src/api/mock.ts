import type {
  AppEvent,
  Booking,
  Commit,
  CurrentUser,
  Entry,
  EntryCreate,
  EntryFilter,
  EntryStart,
  RpcResponse,
  Project,
  Settings,
  Tag,
  Template,
  Ticket,
  TicketComment,
  TicketFilter,
} from "../../../../shared/types";
import { entryFixtures } from "../fixtures/entries";
import { ticketFixtures } from "../fixtures/tickets";
import { projectFixtures } from "../fixtures/projects";
import { tagFixtures } from "../fixtures/tags";
import { templateFixtures } from "../fixtures/templates";
import { bookingFixtures } from "../fixtures/bookings";
import { commentFixtures } from "../fixtures/comments";

// In-Memory-Store für den Browser-Dev-Modus (vite --mode mock).
const store = {
  entries: structuredClone(entryFixtures) as Entry[],
  tickets: structuredClone(ticketFixtures) as Ticket[],
  projects: structuredClone(projectFixtures) as Project[],
  tags: structuredClone(tagFixtures) as Tag[],
  templates: structuredClone(templateFixtures) as Template[],
  bookings: structuredClone(bookingFixtures) as Booking[],
  comments: structuredClone(commentFixtures) as TicketComment[],
  deadEvents: [] as AppEvent[],
  settings: {
    gitlabUrl: "https://gitlab.example.com",
    syncIntervalSec: 300,
  } as Settings,
  currentUser: { id: 1, username: "mockuser", name: "Mock User" } as CurrentUser,
  nextId: 1000,
};

const ok = <T>(data: T): Promise<RpcResponse<T>> => Promise.resolve({ data, error: null });
const fail = <T>(code: string, message: string): Promise<RpcResponse<T>> =>
  Promise.resolve({ data: null, error: { code, message, retry: false } });

const now = () => new Date().toISOString();

export const getEntries = (filter: EntryFilter) => {
  let result = store.entries;
  if (filter.status) result = result.filter((e) => e.status === filter.status);
  if (filter.dateFrom) result = result.filter((e) => e.date >= filter.dateFrom!);
  if (filter.dateTo) result = result.filter((e) => e.date <= filter.dateTo!);
  if (filter.tagIds?.length) {
    result = result.filter((e) => e.tagIds.some((t) => filter.tagIds!.includes(t)));
  }
  // Projekt- und Ticket-Auswahl stammen aus EINEM Picker: untereinander ODER,
  // aber als gemeinsamer UND-Block gegenüber Status/Datum/Tags.
  const hasProjectFilter = Boolean(filter.projectIds?.length);
  const hasTicketFilter = Boolean(filter.ticketIds?.length);
  if (hasProjectFilter || hasTicketFilter) {
    const ticketProjectId = new Map(store.tickets.map((t) => [t.id, t.projectId]));
    result = result.filter((e) => {
      const byTicket = hasTicketFilter
        ? e.ticketIds.some((id) => filter.ticketIds!.includes(id))
        : false;
      const byProject = hasProjectFilter
        ? e.ticketIds.some((id) => {
            const pid = ticketProjectId.get(id);
            return pid !== undefined && filter.projectIds!.includes(pid);
          })
        : false;
      return byTicket || byProject;
    });
  }
  return ok([...result].sort((a, b) => b.date.localeCompare(a.date)));
};

export const getEntry = (id: number) => {
  const entry = store.entries.find((e) => e.id === id);
  return entry ? ok(entry) : fail<Entry>("NOT_FOUND", `Entry ${id} nicht gefunden`);
};

export const getRunningEntry = () => ok(store.entries.find((e) => e.status === "running") ?? null);

export const startEntry = (input: EntryStart) => {
  if (store.entries.some((e) => e.status === "running")) {
    return fail<number>("ALREADY_RUNNING", "Es läuft bereits ein Timer.");
  }
  const id = store.nextId++;
  store.entries.push({
    id,
    notes: input.notes,
    durationMinutes: 0,
    date: input.startAt ?? now(),
    status: "running",
    tagIds: input.tagIds ?? [],
    ticketIds: input.ticketId === null ? [] : [input.ticketId],
    createdAt: now(),
    updatedAt: now(),
  });
  return ok(id);
};

export const stopEntry = (id: number) => {
  const entry = store.entries.find((e) => e.id === id);
  if (!entry) return fail<void>("NOT_FOUND", `Entry ${id} nicht gefunden`);
  if (entry.status !== "running") return fail<void>("NOT_RUNNING", `Entry ${id} läuft nicht.`);
  const elapsedMs = Date.now() - new Date(entry.date).getTime();
  entry.durationMinutes = Math.max(1, Math.round(elapsedMs / 60_000));
  entry.status = "draft";
  entry.updatedAt = now();
  return ok(undefined as void);
};

export const setEntryNotes = (id: number, notes: string | null) => {
  const entry = store.entries.find((e) => e.id === id);
  if (!entry) return fail<void>("NOT_FOUND", `Entry ${id} nicht gefunden`);
  entry.notes = notes;
  entry.updatedAt = now();
  return ok(undefined as void);
};

export const setEntryTags = (id: number, tagIds: number[]) => {
  const entry = store.entries.find((e) => e.id === id);
  if (!entry) return fail<void>("NOT_FOUND", `Entry ${id} nicht gefunden`);
  entry.tagIds = [...tagIds];
  entry.updatedAt = now();
  return ok(undefined as void);
};

export const createEntry = (input: EntryCreate) => {
  const id = store.nextId++;
  store.entries.push({ ...input, id, createdAt: now(), updatedAt: now() });
  return ok(id);
};

export const updateEntry = (entry: Entry) => {
  store.entries = store.entries.map((e) =>
    e.id === entry.id ? { ...entry, updatedAt: now() } : e,
  );
  return ok(undefined as void);
};

export const deleteEntry = (id: number) => {
  store.entries = store.entries.filter((e) => e.id !== id);
  return ok(undefined as void);
};

export const assignTicket = (entryId: number, ticketId: number) => {
  const entry = store.entries.find((e) => e.id === entryId);
  if (entry && !entry.ticketIds.includes(ticketId)) entry.ticketIds.push(ticketId);
  return ok(undefined as void);
};

export const removeTicket = (entryId: number, ticketId: number) => {
  const entry = store.entries.find((e) => e.id === entryId);
  if (entry) entry.ticketIds = entry.ticketIds.filter((t) => t !== ticketId);
  return ok(undefined as void);
};

export const getTickets = (filter: TicketFilter) => {
  let result = store.tickets;
  if (filter.status) result = result.filter((t) => t.status === filter.status);
  if (filter.state) result = result.filter((t) => t.state === filter.state);
  if (filter.assignedToMe) {
    result = result.filter((t) => t.assignees.some((a) => a.gitlabUserId === store.currentUser.id));
  }
  if (filter.pinned) result = result.filter((t) => t.pinned);
  if (filter.unread) result = result.filter((t) => t.unread);
  return ok([...result]);
};

export const getRecentTickets = (limit: number) =>
  ok(store.tickets.filter((t) => t.status === "active").slice(0, limit));

export const getProjects = () => ok([...store.projects]);

export const pinTicket = (ticketId: number) => {
  const t = store.tickets.find((x) => x.id === ticketId);
  if (t) t.pinned = true;
  return ok(undefined as void);
};
export const unpinTicket = (ticketId: number) => {
  const t = store.tickets.find((x) => x.id === ticketId);
  if (t) t.pinned = false;
  return ok(undefined as void);
};
export const getPinnedTickets = () => ok(store.tickets.filter((t) => t.pinned === true));

export const markTicketRead = (ticketId: number) => {
  const t = store.tickets.find((x) => x.id === ticketId);
  if (t) t.unread = false;
  return ok(undefined as void);
};
// Markiert nur die zum Filter passenden Tickets als gelesen (gleiche
// Filter-Logik wie getTickets), analog zum Backend.
export const markAllTicketsRead = (filter: TicketFilter) => {
  let result = store.tickets;
  if (filter.status) result = result.filter((t) => t.status === filter.status);
  if (filter.state) result = result.filter((t) => t.state === filter.state);
  if (filter.assignedToMe) {
    result = result.filter((t) => t.assignees.some((a) => a.gitlabUserId === store.currentUser.id));
  }
  if (filter.pinned) result = result.filter((t) => t.pinned);
  if (filter.unread) result = result.filter((t) => t.unread);
  for (const t of result) t.unread = false;
  return ok(undefined as void);
};
export const getUnreadCount = () =>
  ok(store.tickets.filter((t) => t.status === "active" && t.unread).length);

export const bookEntry = (entryId: number) => {
  const entry = store.entries.find((e) => e.id === entryId);
  if (!entry) return fail<void>("NOT_FOUND", `Entry ${entryId} nicht gefunden`);
  if (entry.ticketIds.length === 0) return fail<void>("NO_TICKET", "Kein Ticket zugewiesen");
  // Im Mock gibt es keinen Worker — Buchung sofort als erledigt simulieren,
  // damit die Booking-History im Dev-Modus etwas anzeigt.
  const ticket = store.tickets.find((t) => t.id === entry.ticketIds[0]);
  if (ticket) {
    store.bookings.push({
      id: store.nextId++,
      entryId,
      ticketId: ticket.id,
      gitlabTimelogId: store.nextId++,
      projectId: ticket.projectId,
      issueIid: ticket.gitlabIid,
      durationMinutes: entry.durationMinutes,
      note: entry.notes ?? "",
      spentAt: entry.date.slice(0, 10),
      bookedAt: now(),
    });
  }
  entry.status = "booked";
  return ok(undefined as void);
};

export const deleteBooking = (bookingId: number) => {
  const booking = store.bookings.find((b) => b.id === bookingId);
  if (!booking) return fail<void>("NOT_FOUND", `Buchung ${bookingId} nicht gefunden`);
  store.bookings = store.bookings.filter((b) => b.id !== bookingId);
  // Entry wieder buchbar machen, sofern keine weitere Buchung mehr existiert.
  if (!store.bookings.some((b) => b.entryId === booking.entryId)) {
    const entry = store.entries.find((e) => e.id === booking.entryId);
    if (entry) entry.status = "draft";
  }
  return ok(undefined as void);
};

export const getBookingsForEntry = (entryId: number) =>
  ok(store.bookings.filter((b) => b.entryId === entryId));

export const getDeadEvents = () => ok([...store.deadEvents]);
export const retryDeadEvent = (eventId: number) => {
  store.deadEvents = store.deadEvents.filter((e) => e.id !== eventId);
  return ok(undefined as void);
};
export const discardDeadEvent = (eventId: number) => {
  store.deadEvents = store.deadEvents.filter((e) => e.id !== eventId);
  return ok(undefined as void);
};

export const getTags = () => ok([...store.tags]);
export const createTag = (tag: Omit<Tag, "id">) => {
  const id = store.nextId++;
  store.tags.push({ ...tag, id });
  return ok(id);
};
export const deleteTag = (id: number) => {
  store.tags = store.tags.filter((t) => t.id !== id);
  return ok(undefined as void);
};

export const getTemplates = () => ok([...store.templates]);
export const createTemplate = (t: Omit<Template, "id">) => {
  const id = store.nextId++;
  store.templates.push({ ...t, id });
  return ok(id);
};
export const updateTemplate = (t: Template) => {
  store.templates = store.templates.map((x) => (x.id === t.id ? t : x));
  return ok(undefined as void);
};
export const deleteTemplate = (id: number) => {
  store.templates = store.templates.filter((t) => t.id !== id);
  return ok(undefined as void);
};

export const triggerSync = () => ok(undefined as void);
export const getSettings = () => ok({ ...store.settings });
export const getCurrentUser = () => ok(store.currentUser);
export const getTicketComments = (ticketId: number) =>
  ok(store.comments.filter((c) => c.ticketId === ticketId));
export const syncTicketComments = (_ticketId: number) => ok(undefined as void);
export const getTicket = (ticketId: number) => {
  const t = store.tickets.find((x) => x.id === ticketId);
  return t ? ok(t) : fail<Ticket | null>("NOT_FOUND", `Ticket ${ticketId} nicht gefunden`);
};
// Inline gerenderter grauer SVG-Placeholder (400x200, "Bild (Mock)"), damit der
// Inline-Bild-Pfad im Dev-Modus (vite --mode mock) sichtbar ist.
const MOCK_IMAGE_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2NjY2NjYyIvPjx0ZXh0IHg9IjIwMCIgeT0iMTA1IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMCIgZmlsbD0iIzY2NjY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+QmlsZCAoTW9jayk8L3RleHQ+PC9zdmc+";
export const getGitlabImage = (_url: string) => ok(MOCK_IMAGE_DATA_URL);
export const saveSettings = (s: Settings) => {
  store.settings = { ...s };
  return ok(undefined as void);
};
export const setGitLabToken = (_token: string) => ok(undefined as void);
export const backupDatabase = (_destPath: string) => ok(undefined as void);
export const getCommitsForDate = (_date: string): Promise<RpcResponse<Commit[]>> =>
  ok([
    {
      hash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      shortHash: "a1b2c3d4",
      title: "Fix login validation for edge cases",
      authorName: "Max Mustermann",
      createdAt: "2026-06-19T14:30:00Z",
      webUrl: "https://gitlab.example.com/acme/frontend/-/commit/a1b2c3d4",
      projectId: 1,
    },
    {
      hash: "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
      shortHash: "b2c3d4e5",
      title: "Add unit tests for auth module",
      authorName: "Max Mustermann",
      createdAt: "2026-06-19T11:15:00Z",
      webUrl: "https://gitlab.example.com/acme/frontend/-/commit/b2c3d4e5",
      projectId: 1,
    },
    {
      hash: "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
      shortHash: "c3d4e5f6",
      title: "Update API documentation",
      authorName: "Max Mustermann",
      createdAt: "2026-06-19T09:45:00Z",
      webUrl: "https://gitlab.example.com/acme/backend/-/commit/c3d4e5f6",
      projectId: 2,
    },
  ]);
