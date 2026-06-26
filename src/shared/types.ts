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

// Assignee eines Tickets — denormalisiert pro Ticket gespeichert (kein users-Table).
export interface TicketAssignee {
  gitlabUserId: number;
  username: string;
  name: string;
}

// Ein GitLab-Label eines Tickets (Anzeige als Badge; color ist ein CSS-Hex-Wert).
export interface TicketLabel {
  title: string;
  color: string;
}

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
  assignees: TicketAssignee[];
  // GitLab-Issue-Metadaten (read-only, im Issue-Sync gefüllt; null wenn nicht gesetzt).
  description: string | null; // Markdown
  descriptionHtml: string | null; // gerendertes HTML von GitLab
  labels: TicketLabel[];
  author: { username: string; name: string } | null;
  milestoneTitle: string | null;
  dueDate: string | null; // ISO-Date (YYYY-MM-DD)
  issueCreatedAt: string | null; // ISO-UTC der Issue-Erstellung in GitLab
  pinned: boolean;
  // Ungelesen: kein read-state-Eintrag (neues Ticket) ODER notesCount > zuletzt gesehener Count.
  unread: boolean;
  lastViewedAt: string | null; // ISO-UTC des letzten "Als gelesen markieren"; null = nie als gelesen markiert
  // Anzahl der GitLab-Kommentare (userNotesCount), nur im Issue-Sync aktualisiert
  notesCount: number;
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketFilter {
  status?: TicketStatus;
  state?: TicketState;
  // Nur Tickets, die dem aktuellen GitLab-User zugewiesen sind. Die konkrete
  // User-ID hält der Filter NICHT — sie kommt im Repository als zweiter Parameter
  // vom Service (Single Source: settings.getCurrentUser).
  assignedToMe?: boolean;
  // Lokaler Pin-Status (nicht aus GitLab gesynct) — nur gepinnte Tickets.
  pinned?: boolean;
  // Nur Tickets mit ungelesenen Kommentaren.
  unread?: boolean;
}

// Ein einzelner GitLab-Kommentar (Note) eines Tickets, lokal gespiegelt.
export interface TicketComment {
  id: number;
  ticketId: number;
  gitlabNoteId: number;
  // Hash-Teil der GitLab-Discussion-GID: gruppiert Replies. Mehrere Kommentare mit
  // gleicher discussionId bilden einen Thread; leer/distinct = Top-Level.
  discussionId: string;
  authorUsername: string;
  authorName: string;
  body: string; // Markdown (für Suche)
  bodyHtml: string; // gerendertes HTML von GitLab (für Anzeige)
  isSystem: boolean;
  createdAt: string; // ISO UTC
  updatedAt: string; // ISO UTC
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

// ── Background Status (read-only Anzeige der Hintergrundprozesse) ─────────────

// Status eines automatischen Schedulers-Jobs (read-only Anzeige).
export interface ScheduleStatus {
  name: string; // z.B. "gitlab_sync", "orphan_check", "comment_sync"
  intervalSec: number;
  lastRunAt: string | null; // ISO-UTC; null = noch nie gelaufen
  nextRunAt: string | null; // ISO-UTC, berechnet (lastRun + interval); null = sofort fällig
}

// Aggregierter Status aller Hintergrundprozesse für die UI-Anzeige.
export interface BackgroundStatus {
  syncRunning: boolean; // GitLab-Sync läuft gerade (In-Memory-Flag des Sync-Service)
  schedules: ScheduleStatus[];
  queue: { pending: number; processing: number; dead: number }; // Booking-Event-Queue
}

// ── Settings ─────────────────────────────────────────────────────────────────

export interface Settings {
  gitlabUrl: string;
  syncIntervalSec: number;
  // Absoluter Pfad zum dedizierten Todo-Unterordner (z.B. ".../Vault/todos").
  // Leer = kein Ordner konfiguriert (Todo-Modul zeigt Empty State).
  todoFolder: string;
  // OS-Benachrichtigung (einmal pro Tag) über heute fällige/überfällige Todos.
  todoRemindersEnabled: boolean;
  // Tägliche Uhrzeit (HH:mm, Europe/Berlin), ab der die Reminder-Benachrichtigung
  // frühestens feuern darf. Default "09:00". Nullgepaddet für String-Vergleich.
  reminderTime: string;
}

// ── Todos (Markdown-Vault als Source of Truth, Phase 1, kein SQLite) ──────────

export type TodoPriority = "highest" | "high" | "medium" | "normal" | "low" | "lowest";

export interface TodoTask {
  // FLÜCHTIGE Laufzeit-Handle (z.B. `listId#seq`), NICHT stabil über Reloads.
  // Nur zwischen einem getTodoLists/getList und der direkt folgenden Mutation
  // gültig — Mutationen relokalisieren die Zeile über den Roh-Zeilen-Fingerprint,
  // nicht über diese id.
  id: string;
  listId: string;
  section: string | null;
  title: string;
  done: boolean;
  priority: TodoPriority;
  due: string | null; // YYYY-MM-DD
  scheduled: string | null; // YYYY-MM-DD
  start: string | null; // YYYY-MM-DD
  created: string | null; // YYYY-MM-DD
  doneDate: string | null; // YYYY-MM-DD
  recurrence: string | null; // Roher Regeltext (z.B. "every week")
  // false = Regel unbekannt/komplex → read-only-Fallback (in entries nicht
  // abhakbar, in Obsidian abhaken).
  recurrenceEditableInApp: boolean;
  tags: string[];
  depth: number; // Einrückungstiefe (0 = top-level, >0 = Subtask)
  // Mehrzeilige Notiz/Beschreibung: die unmittelbar unter der Task-Zeile
  // folgenden, stärker eingerückten Nicht-Task-Zeilen (Obsidian-Layout-Annahme).
  // Dedented (ohne die Task-Indent+2-Spaces-Einrückung), Zeilen mit "\n" verbunden;
  // null = keine Beschreibung. Geschrieben wird nur bei expliziter Änderung.
  description: string | null;
}

export interface TodoList {
  id: string;
  name: string;
  tasks: TodoTask[];
  sections: string[];
}

export interface TodoTaskCreate {
  listId: string;
  section?: string;
  title: string;
  priority?: TodoPriority;
  due?: string;
  tags?: string[];
  // Optional: Subtask anlegen. Ist parentId gesetzt, wird der neue Task als
  // eingerücktes Kind direkt unter den Parent-Block gehängt; section wird dann
  // ignoriert (der Subtask erbt die Position des Parents).
  parentId?: string;
}

export interface TodoTaskPatch {
  id: string;
  listId: string;
  title?: string;
  done?: boolean;
  priority?: TodoPriority;
  due?: string | null;
  scheduled?: string | null;
  start?: string | null;
  tags?: string[];
  section?: string | null;
  // Mehrzeilige Beschreibung. undefined = unverändert lassen; null oder "" =
  // Beschreibung entfernen; sonst neuer Beschreibungstext (dedented, mit "\n").
  description?: string | null;
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
      pinTicket: { params: { ticketId: number }; response: RpcResponse<void> };
      unpinTicket: { params: { ticketId: number }; response: RpcResponse<void> };
      markTicketRead: { params: { ticketId: number }; response: RpcResponse<void> };
      markAllTicketsRead: { params: { filter: TicketFilter }; response: RpcResponse<void> };
      getUnreadCount: { params: Record<string, never>; response: RpcResponse<number> };
      getPinnedTickets: { params: Record<string, never>; response: RpcResponse<Ticket[]> };
      getTicketComments: { params: { ticketId: number }; response: RpcResponse<TicketComment[]> };
      getTicket: { params: { ticketId: number }; response: RpcResponse<Ticket | null> };
      syncTicketComments: { params: { ticketId: number }; response: RpcResponse<void> };
      getGitlabImage: { params: { url: string }; response: RpcResponse<string> };
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
      getBackgroundStatus: {
        params: Record<string, never>;
        response: RpcResponse<BackgroundStatus>;
      };
      getSettings: { params: Record<string, never>; response: RpcResponse<Settings> };
      getCurrentUser: { params: Record<string, never>; response: RpcResponse<CurrentUser | null> };
      saveSettings: { params: Settings; response: RpcResponse<void> };
      setGitLabToken: { params: { token: string }; response: RpcResponse<void> };
      backupDatabase: { params: { destPath: string }; response: RpcResponse<void> };

      // Todos (Markdown-Vault). addTodoTask gibt void zurück (kein id-Return,
      // da ids flüchtig sind). updateTodoTask deckt done ab (kein toggle-RPC).
      getTodoLists: { params: Record<string, never>; response: RpcResponse<TodoList[]> };
      createTodoList: { params: { name: string }; response: RpcResponse<void> };
      addTodoTask: { params: TodoTaskCreate; response: RpcResponse<void> };
      updateTodoTask: { params: TodoTaskPatch; response: RpcResponse<void> };
      deleteTodoTask: { params: { id: string; listId: string }; response: RpcResponse<void> };
      moveTodoTask: {
        params: { id: string; fromList: string; toList: string; toSection?: string | null };
        response: RpcResponse<void>;
      };
      reorderTodoTask: {
        params: { listId: string; id: string; targetId: string; before: boolean };
        response: RpcResponse<void>;
      };
      // Gespeicherte Filter ("Saved Filters"): das Backend bleibt schema-agnostisch
      // und behandelt den Inhalt als opaken JSON-String (Muster wie Template.payload).
      // Die Struktur eines SavedFilter gehört dem Frontend.
      getTodoSavedFilters: { params: Record<string, never>; response: RpcResponse<string> };
      setTodoSavedFilters: { params: { json: string }; response: RpcResponse<void> };
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
      todosChanged: Record<string, never>;
    };
  };
}
