// Single Source of Truth für alle Domain- und RPC-Typen.
// Bun-Seite und Frontend-Seite importieren ausschliesslich von hier.
// Reine TypeScript-Typen — kein Import aus electrobun/* (Frontend-Bundle bleibt schlank).
//
// Das vollständige AppRPCType (RPC-Schema) wird in Phase 03 ergänzt.

// ── Entries ─────────────────────────────────────────────────────────────────

export type EntryStatus = "draft" | "pending_booking" | "booked" | "orphaned";

export interface Entry {
  id: number;
  title: string;
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
  tagIds?: number[];
}

// ── Tickets (aus GitLab gesynct, read-only im UI) ────────────────────────────

export type TicketState = "opened" | "closed" | "locked";
export type TicketStatus = "active" | "orphaned";

export interface Ticket {
  id: number;
  gitlabIid: number;
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

// ── Bookings (Zeitbuchungen gegen GitLab, eine Zeile pro erfolgreichem Spend) ──

export interface Booking {
  id: number;
  entryId: number;
  ticketId: number;
  gitlabNoteId: number;
  projectId: number;
  issueIid: number;
  durationMinutes: number;
  note: string; // an GitLab gesendeter Buchungstext (max. 255 Zeichen)
  spentAt: string; // ISO-Date (YYYY-MM-DD), an GitLab gesendetes Buchungsdatum
  bookedAt: string; // ISO-UTC, Zeitpunkt der tatsächlichen Buchung
}

export type BookingInsert = Omit<Booking, "id" | "bookedAt">;

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
  projectId: number;
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
      createEntry: { params: EntryCreate; response: RpcResponse<number> };
      updateEntry: { params: Entry; response: RpcResponse<void> };
      deleteEntry: { params: { id: number }; response: RpcResponse<void> };
      getTickets: { params: TicketFilter; response: RpcResponse<Ticket[]> };
      assignTicket: { params: { entryId: number; ticketId: number }; response: RpcResponse<void> };
      removeTicket: { params: { entryId: number; ticketId: number }; response: RpcResponse<void> };
      bookEntry: { params: { entryId: number }; response: RpcResponse<void> };
      getBookingsForEntry: { params: { entryId: number }; response: RpcResponse<Booking[]> };
      getDeadEvents: { params: Record<string, never>; response: RpcResponse<AppEvent[]> };
      retryDeadEvent: { params: { eventId: number }; response: RpcResponse<void> };
      getTags: { params: Record<string, never>; response: RpcResponse<Tag[]> };
      createTag: { params: Omit<Tag, "id">; response: RpcResponse<number> };
      deleteTag: { params: { id: number }; response: RpcResponse<void> };
      getTemplates: { params: Record<string, never>; response: RpcResponse<Template[]> };
      createTemplate: { params: Omit<Template, "id">; response: RpcResponse<number> };
      updateTemplate: { params: Template; response: RpcResponse<void> };
      deleteTemplate: { params: { id: number }; response: RpcResponse<void> };
      triggerSync: { params: Record<string, never>; response: RpcResponse<void> };
      getSettings: { params: Record<string, never>; response: RpcResponse<Settings> };
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
    };
  };
}
