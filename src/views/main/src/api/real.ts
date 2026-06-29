import { Electroview } from "electrobun/view";
import type {
  AppRPCType,
  Entry,
  EntryCreate,
  EntryFilter,
  EntryStart,
  Settings,
  Tag,
  Template,
  TicketFilter,
  TodoTaskCreate,
  TodoTaskPatch,
} from "../../../../shared/types";
import { queryClient } from "../lib/queryClient";
import { keys } from "../lib/queryKeys";
import type { SyncStatus } from "../lib/queryKeys";
import { toast } from "../lib/toast";

// Einzige Datei, die electrobun/view importiert. Message-Handler invalidieren
// die betroffenen Queries — nie Event-Handler in Komponenten.
const rpc = Electroview.defineRPC<AppRPCType>({
  handlers: {
    requests: {},
    messages: {
      syncCompleted: () => {
        queryClient.setQueryData<SyncStatus>(keys.syncStatus(), { error: null });
        queryClient.invalidateQueries({ queryKey: keys.tickets() });
        queryClient.invalidateQueries({ queryKey: keys.entries() });
        toast.success("Sync abgeschlossen");
      },
      // Sync ist Fire-and-Forget: der Fehler kommt asynchron als Event, nicht als
      // RPC-Antwort. Früher wurde er hier verworfen ("null infos") — jetzt im Cache
      // ablegen, damit die TicketsPage ihn anzeigt, und auf der Konsole loggen.
      syncFailed: (payload) => {
        console.error("Sync fehlgeschlagen:", payload.error);
        queryClient.setQueryData<SyncStatus>(keys.syncStatus(), { error: payload.error });
        toast.error(`Sync fehlgeschlagen: ${payload.error}`);
      },
      bookingCompleted: () => {
        queryClient.invalidateQueries({ queryKey: keys.entries() });
        queryClient.invalidateQueries({ queryKey: keys.bookings() });
        queryClient.invalidateQueries({ queryKey: keys.deadEvents() });
        toast.success("Buchung abgeschlossen");
      },
      bookingFailed: (payload) => {
        queryClient.invalidateQueries({ queryKey: keys.deadEvents() });
        toast.error(`Buchung fehlgeschlagen: ${payload.error}`);
      },
      orphanDetected: () => {
        queryClient.invalidateQueries({ queryKey: keys.tickets() });
      },
      runningEntryChanged: () => {
        queryClient.invalidateQueries({ queryKey: keys.runningEntry() });
      },
      // Watcher meldet eine externe oder eigene Vault-Änderung → die eine
      // getTodoLists-Query neu laden (speist alle Smart-Views).
      todosChanged: () => {
        queryClient.invalidateQueries({ queryKey: keys.todos() });
      },
    },
  },
});

const electroview = new Electroview({ rpc });
const r = electroview.rpc!.request;

export const getEntries = (filter: EntryFilter) => r.getEntries(filter);
export const getEntry = (id: number) => r.getEntry({ id });
export const getRunningEntry = () => r.getRunningEntry({});
export const startEntry = (input: EntryStart) => r.startEntry(input);
export const stopEntry = (id: number) => r.stopEntry({ id });
export const resumeEntry = (id: number) => r.resumeEntry({ id });
export const setEntryNotes = (id: number, notes: string | null) => r.setEntryNotes({ id, notes });
export const setEntryTags = (id: number, tagIds: number[]) => r.setEntryTags({ id, tagIds });
export const createEntry = (entry: EntryCreate) => r.createEntry(entry);
export const updateEntry = (entry: Entry) => r.updateEntry(entry);
export const deleteEntry = (id: number) => r.deleteEntry({ id });
export const assignTicket = (entryId: number, ticketId: number) =>
  r.assignTicket({ entryId, ticketId });
export const removeTicket = (entryId: number, ticketId: number) =>
  r.removeTicket({ entryId, ticketId });
export const getTickets = (filter: TicketFilter) => r.getTickets(filter);
export const getRecentTickets = (limit: number) => r.getRecentTickets({ limit });
export const getProjects = () => r.getProjects({});
export const pinTicket = (ticketId: number) => r.pinTicket({ ticketId });
export const unpinTicket = (ticketId: number) => r.unpinTicket({ ticketId });
export const getPinnedTickets = () => r.getPinnedTickets({});
export const markTicketRead = (ticketId: number) => r.markTicketRead({ ticketId });
export const markAllTicketsRead = (filter: TicketFilter) => r.markAllTicketsRead({ filter });
export const getUnreadCount = () => r.getUnreadCount({});
export const bookEntry = (entryId: number) => r.bookEntry({ entryId });
export const deleteBooking = (bookingId: number) => r.deleteBooking({ bookingId });
export const getBookingsForEntry = (entryId: number) => r.getBookingsForEntry({ entryId });
export const getDeadEvents = () => r.getDeadEvents({});
export const getBackgroundStatus = () => r.getBackgroundStatus({});
export const retryDeadEvent = (eventId: number) => r.retryDeadEvent({ eventId });
export const discardDeadEvent = (eventId: number) => r.discardDeadEvent({ eventId });
export const getTags = () => r.getTags({});
export const createTag = (tag: Omit<Tag, "id">) => r.createTag(tag);
export const deleteTag = (id: number) => r.deleteTag({ id });
export const getTemplates = () => r.getTemplates({});
export const createTemplate = (t: Omit<Template, "id">) => r.createTemplate(t);
export const updateTemplate = (t: Template) => r.updateTemplate(t);
export const deleteTemplate = (id: number) => r.deleteTemplate({ id });
export const triggerSync = () => r.triggerSync({});
export const getSettings = () => r.getSettings({});
export const saveSettings = (s: Settings) => r.saveSettings(s);
export const setGitLabToken = (token: string) => r.setGitLabToken({ token });
export const backupDatabase = (destPath: string) => r.backupDatabase({ destPath });
export const getCommitsForDate = (date: string) => r.getCommitsForDate({ date });
export const getCurrentUser = () => r.getCurrentUser({});
export const getTicketComments = (ticketId: number) => r.getTicketComments({ ticketId });
export const syncTicketComments = (ticketId: number) => r.syncTicketComments({ ticketId });
export const getTicket = (ticketId: number) => r.getTicket({ ticketId });
export const getGitlabImage = (url: string) => r.getGitlabImage({ url });

// Todos (Markdown-Vault). ids sind flüchtig — addTodoTask gibt void zurück,
// updateTodoTask deckt done ab (kein toggle-RPC).
export const getTodoLists = () => r.getTodoLists({});
export const createTodoList = (name: string) => r.createTodoList({ name });
export const addTodoTask = (input: TodoTaskCreate) => r.addTodoTask(input);
export const updateTodoTask = (patch: TodoTaskPatch) => r.updateTodoTask(patch);
export const deleteTodoTask = (id: string, listId: string) => r.deleteTodoTask({ id, listId });
export const moveTodoTask = (
  id: string,
  fromList: string,
  toList: string,
  toSection?: string | null,
) => r.moveTodoTask({ id, fromList, toList, toSection });
export const reorderTodoTask = (listId: string, id: string, targetId: string, before: boolean) =>
  r.reorderTodoTask({ listId, id, targetId, before });
export const indentTodoTask = (id: string, listId: string, direction: "indent" | "outdent") =>
  r.indentTodoTask({ id, listId, direction });

// Saved Filters: opaker JSON-String (Struktur liegt im Frontend, siehe savedFilters.ts).
export const getTodoSavedFilters = () => r.getTodoSavedFilters({});
export const setTodoSavedFilters = (json: string) => r.setTodoSavedFilters({ json });
