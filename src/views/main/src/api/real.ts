import { Electroview } from "electrobun/view";
import type {
  AppRPCType,
  Entry,
  EntryCreate,
  EntryFilter,
  Settings,
  Tag,
  Template,
  TicketFilter,
} from "../../../../shared/types";
import { queryClient } from "../lib/queryClient";
import { keys } from "../lib/queryKeys";

// Einzige Datei, die electrobun/view importiert. Message-Handler invalidieren
// die betroffenen Queries — nie Event-Handler in Komponenten.
const rpc = Electroview.defineRPC<AppRPCType>({
  handlers: {
    requests: {},
    messages: {
      syncCompleted: () => {
        queryClient.invalidateQueries({ queryKey: keys.tickets() });
        queryClient.invalidateQueries({ queryKey: keys.entries() });
      },
      syncFailed: () => {},
      bookingCompleted: () => {
        queryClient.invalidateQueries({ queryKey: keys.entries() });
        queryClient.invalidateQueries({ queryKey: keys.bookings() });
        queryClient.invalidateQueries({ queryKey: keys.deadEvents() });
      },
      bookingFailed: () => {
        queryClient.invalidateQueries({ queryKey: keys.deadEvents() });
      },
      orphanDetected: () => {
        queryClient.invalidateQueries({ queryKey: keys.tickets() });
      },
    },
  },
});

const electroview = new Electroview({ rpc });
const r = electroview.rpc!.request;

export const getEntries = (filter: EntryFilter) => r.getEntries(filter);
export const getEntry = (id: number) => r.getEntry({ id });
export const createEntry = (entry: EntryCreate) => r.createEntry(entry);
export const updateEntry = (entry: Entry) => r.updateEntry(entry);
export const deleteEntry = (id: number) => r.deleteEntry({ id });
export const assignTicket = (entryId: number, ticketId: number) =>
  r.assignTicket({ entryId, ticketId });
export const removeTicket = (entryId: number, ticketId: number) =>
  r.removeTicket({ entryId, ticketId });
export const getTickets = (filter: TicketFilter) => r.getTickets(filter);
export const bookEntry = (entryId: number) => r.bookEntry({ entryId });
export const getBookingsForEntry = (entryId: number) => r.getBookingsForEntry({ entryId });
export const getDeadEvents = () => r.getDeadEvents({});
export const retryDeadEvent = (eventId: number) => r.retryDeadEvent({ eventId });
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
