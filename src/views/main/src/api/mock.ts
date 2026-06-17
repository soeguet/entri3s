import type {
  AppEvent,
  Booking,
  Entry,
  EntryCreate,
  EntryFilter,
  RpcResponse,
  Project,
  Settings,
  Tag,
  Template,
  Ticket,
  TicketFilter,
} from "../../../../shared/types";
import { entryFixtures } from "../fixtures/entries";
import { ticketFixtures } from "../fixtures/tickets";
import { projectFixtures } from "../fixtures/projects";
import { tagFixtures } from "../fixtures/tags";
import { templateFixtures } from "../fixtures/templates";
import { bookingFixtures } from "../fixtures/bookings";

// In-Memory-Store für den Browser-Dev-Modus (vite --mode mock).
const store = {
  entries: structuredClone(entryFixtures) as Entry[],
  tickets: structuredClone(ticketFixtures) as Ticket[],
  projects: structuredClone(projectFixtures) as Project[],
  tags: structuredClone(tagFixtures) as Tag[],
  templates: structuredClone(templateFixtures) as Template[],
  bookings: structuredClone(bookingFixtures) as Booking[],
  deadEvents: [] as AppEvent[],
  settings: {
    gitlabUrl: "https://gitlab.example.com",
    syncIntervalSec: 300,
  } as Settings,
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
  return ok([...result].sort((a, b) => b.date.localeCompare(a.date)));
};

export const getEntry = (id: number) => {
  const entry = store.entries.find((e) => e.id === id);
  return entry ? ok(entry) : fail<Entry>("NOT_FOUND", `Entry ${id} nicht gefunden`);
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
  return ok([...result]);
};

export const getRecentTickets = (limit: number) =>
  ok(store.tickets.filter((t) => t.status === "active").slice(0, limit));

export const getProjects = () => ok([...store.projects]);

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
export const saveSettings = (s: Settings) => {
  store.settings = { ...s };
  return ok(undefined as void);
};
export const setGitLabToken = (_token: string) => ok(undefined as void);
export const backupDatabase = (_destPath: string) => ok(undefined as void);
