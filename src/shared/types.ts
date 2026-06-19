// Single Source of Truth für alle Domain- und RPC-Typen.
// Bun-Seite und Frontend-Seite importieren ausschliesslich von hier.
// Reine TypeScript-Typen — kein Import aus electrobun/* (Frontend-Bundle bleibt schlank).
//
// Das vollständige AppRPCType (RPC-Schema) wird in Phase 03 ergänzt.

// ── Entries ─────────────────────────────────────────────────────────────────

// Lebenszyklus eines Entries. `booking_failed` = Buchung endgültig gescheitert
// (alle Retries verbraucht); bewusst eigener Entry-Status, NICHT zu verwechseln
// mit dem Event-Queue-Status `dead` (siehe AppEventStatus weiter unten), der nur
// das Outbox-Event betrifft, nicht den Entry.
export type EntryStatus =
  | "running"
  | "draft"
  | "pending_booking"
  | "booked"
  | "booking_failed"
  | "orphaned";

// Parameter zum Starten eines laufenden Entries. `startAt` (ISO-UTC) erlaubt
// gapfreies Anschliessen an einen vorigen Entry; ohne Angabe = jetzt.
export interface EntryStart {
  ticketId: number | null;
  notes: string | null;
  tagIds?: number[];
  startAt?: string;
}

export interface Entry {
  id: number;
  notes: string | null;
  durationMinutes: number;
  date: string; // ISO UTC
  status: EntryStatus;
  tagIds: number[];
  ticketIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface EntryFilter {
  dateFrom?: string;
  dateTo?: string;
  status?: EntryStatus;
  // Mehrfachauswahl, jeweils ODER-Match innerhalb der Kategorie.
  tagIds?: number[];
  // Projekt- und Ticket-Auswahl stammen aus EINEM Hierarchie-Picker und werden
  // untereinander mit ODER verknüpft (Projekt A ODER Ticket #5). Tags, Status und
  // Datum hingegen mit UND.
  projectIds?: number[];
  ticketIds?: number[];
}

// ── Tickets (aus GitLab gesynct, read-only im UI) ────────────────────────────

export type TicketState = "opened" | "closed" | "locked";
export type TicketStatus = "active" | "orphaned";

export interface Ticket {
  id: number;
  gitlabIid: number;
  gitlabGlobalId: number | null; // globale GitLab-Issue-ID (für GraphQL-GID bei Buchungen)
  projectId: number;
  title: string;
  state: TicketState;
  status: TicketStatus;
  timeEstimate: number | null; // Sekunden
  timeSpent: number | null; // Sekunden
  webUrl: string | null;
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketFilter {
  status?: TicketStatus;
  state?: TicketState;
}

// ── Projects (aus GitLab gesynct; fullPath kodiert die Gruppenhierarchie) ──────

export interface Project {
  id: number; // GitLab numerische Projekt-ID (= Ticket.projectId)
  fullPath: string; // z.B. "acme/backend/api-service"
  name: string; // Anzeigename des Projektblatts
  syncedAt: string | null;
}

// ── Bookings (Zeitbuchungen gegen GitLab, eine Zeile pro erfolgreichem Timelog) ──

export interface Booking {
  id: number;
  entryId: number;
  ticketId: number;
  gitlabTimelogId: number; // ID des GitLab-Timelogs (GraphQL), Rückreferenz + für timelogDelete
  projectId: number;
  issueIid: number;
  durationMinutes: number;
  note: string; // an GitLab gesendete Timelog-Summary (max. 255 Zeichen)
  spentAt: string; // ISO-Date (YYYY-MM-DD), an GitLab gesendetes Buchungsdatum
  bookedAt: string; // ISO-UTC, Zeitpunkt der tatsächlichen Buchung
}

export type BookingInsert = Omit<Booking, "id" | "bookedAt">;

// ── Commits (on-demand von GitLab, nicht persistiert) ────────────────────────

export interface Commit {
  hash: string;
  shortHash: string;
  title: string;
  authorName: string;
  createdAt: string; // ISO-UTC
  webUrl: string;
  projectId: number;
}

export interface CurrentUser {
  id: number;
  username: string;
  name: string;
}

// ── Tags & Templates ─────────────────────────────────────────────────────────

export interface Tag {
  id: number;
  name: string;
  color: string | null;
}

export interface Template {
  id: number;
  name: string;
  payload: string; // JSON: vorbefüllte Entry-Felder
}

// ── Events (Outbox / Dead-Letter) ────────────────────────────────────────────

export type AppEventStatus = "pending" | "processing" | "done" | "dead";

export interface AppEvent {
  id: number;
  type: string;
  status: AppEventStatus;
  error: string | null;
  createdAt: string;
}

// ── Settings ─────────────────────────────────────────────────────────────────

export interface Settings {
  gitlabUrl: string;
  syncIntervalSec: number;
}

// ── RPC Plumbing ─────────────────────────────────────────────────────────────

export interface AppError {
  code: string;
  message: string;
  retry: boolean;
}

export type RpcResponse<T> = { data: T; error: null } | { data: null; error: AppError };

export type EntryCreate = Omit<Entry, "id" | "createdAt" | "updatedAt">;

// ── RPC Schema ───────────────────────────────────────────────────────────────
// Strukturell kompatibel mit electrobuns ElectrobunRPCSchema
// ({ bun: { requests; messages }; webview: { requests; messages } }),
// aber als reiner TS-Typ ohne electrobun-Import.
//
//   bun.requests      → was der Main Process implementiert (Frontend ruft auf)
//   webview.messages  → Events, die der Main Process an das Frontend sendet

export interface AppRPCType {
  bun: {
    requests: {
      getEntries: { params: EntryFilter; response: RpcResponse<Entry[]> };
      getEntry: { params: { id: number }; response: RpcResponse<Entry> };
      getRunningEntry: { params: Record<string, never>; response: RpcResponse<Entry | null> };
      startEntry: { params: EntryStart; response: RpcResponse<number> };
      stopEntry: { params: { id: number }; response: RpcResponse<void> };
      setEntryNotes: { params: { id: number; notes: string | null }; response: RpcResponse<void> };
      setEntryTags: { params: { id: number; tagIds: number[] }; response: RpcResponse<void> };
      createEntry: { params: EntryCreate; response: RpcResponse<number> };
      updateEntry: { params: Entry; response: RpcResponse<void> };
      deleteEntry: { params: { id: number }; response: RpcResponse<void> };
      getTickets: { params: TicketFilter; response: RpcResponse<Ticket[]> };
      getRecentTickets: { params: { limit: number }; response: RpcResponse<Ticket[]> };
      getProjects: { params: Record<string, never>; response: RpcResponse<Project[]> };
      assignTicket: { params: { entryId: number; ticketId: number }; response: RpcResponse<void> };
      removeTicket: { params: { entryId: number; ticketId: number }; response: RpcResponse<void> };
      bookEntry: { params: { entryId: number }; response: RpcResponse<void> };
      deleteBooking: { params: { bookingId: number }; response: RpcResponse<void> };
      getBookingsForEntry: { params: { entryId: number }; response: RpcResponse<Booking[]> };
      getCommitsForDate: { params: { date: string }; response: RpcResponse<Commit[]> };
      getDeadEvents: { params: Record<string, never>; response: RpcResponse<AppEvent[]> };
      retryDeadEvent: { params: { eventId: number }; response: RpcResponse<void> };
      discardDeadEvent: { params: { eventId: number }; response: RpcResponse<void> };
      getTags: { params: Record<string, never>; response: RpcResponse<Tag[]> };
      createTag: { params: Omit<Tag, "id">; response: RpcResponse<number> };
      deleteTag: { params: { id: number }; response: RpcResponse<void> };
      getTemplates: { params: Record<string, never>; response: RpcResponse<Template[]> };
      createTemplate: { params: Omit<Template, "id">; response: RpcResponse<number> };
      updateTemplate: { params: Template; response: RpcResponse<void> };
      deleteTemplate: { params: { id: number }; response: RpcResponse<void> };
      triggerSync: { params: Record<string, never>; response: RpcResponse<void> };
      getSettings: { params: Record<string, never>; response: RpcResponse<Settings> };
      getCurrentUser: { params: Record<string, never>; response: RpcResponse<CurrentUser | null> };
      saveSettings: { params: Settings; response: RpcResponse<void> };
      setGitLabToken: { params: { token: string }; response: RpcResponse<void> };
      backupDatabase: { params: { destPath: string }; response: RpcResponse<void> };
    };
    messages: Record<string, never>;
  };
  webview: {
    requests: Record<string, never>;
    messages: {
      syncCompleted: Record<string, never>;
      syncFailed: { error: string };
      bookingCompleted: Record<string, never>;
      bookingFailed: { error: string };
      orphanDetected: { count: number };
      runningEntryChanged: Record<string, never>;
    };
  };
}
