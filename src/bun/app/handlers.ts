import { BrowserView } from "electrobun/bun";
import type { AppRPCType, RpcResponse } from "../../shared/types";
import type { Services } from "../service";
import { toAppError } from "./errors";

/** Vereinheitlicht try/catch → RpcResponse für jeden Handler. */
async function wrap<T>(fn: () => T | Promise<T>): Promise<RpcResponse<T>> {
  try {
    return { data: await fn(), error: null };
  } catch (e) {
    return { data: null, error: toAppError(e) };
  }
}

/**
 * RPC-Facade: delegiert ausschliesslich an Services, fängt Exceptions und
 * mappt sie auf AppError. Kein direkter Repository-Zugriff hier.
 */
export function createRpc(svc: Services) {
  return BrowserView.defineRPC<AppRPCType>({
    maxRequestTime: 10_000,
    handlers: {
      requests: {
        // Entries
        getEntries: (filter) => wrap(() => svc.entry.getAll(filter)),
        getEntry: (p) => wrap(() => svc.entry.getById(p.id)),
        getRunningEntry: () => wrap(() => svc.entry.getRunning()),
        startEntry: (p) => wrap(() => svc.entry.start(p)),
        stopEntry: (p) => wrap(() => svc.entry.stop(p.id)),
        setEntryNotes: (p) => wrap(() => svc.entry.setNotes(p.id, p.notes)),
        setEntryTags: (p) => wrap(() => svc.entry.setTags(p.id, p.tagIds)),
        createEntry: (entry) => wrap(() => svc.entry.create(entry)),
        updateEntry: (entry) => wrap(() => svc.entry.update(entry)),
        deleteEntry: (p) => wrap(() => svc.entry.delete(p.id)),
        assignTicket: (p) => wrap(() => svc.entry.assignTicket(p.entryId, p.ticketId)),
        removeTicket: (p) => wrap(() => svc.entry.removeTicket(p.entryId, p.ticketId)),

        // Tickets
        getTickets: (filter) => wrap(() => svc.ticket.getAll(filter)),
        getRecentTickets: (p) => wrap(() => svc.ticket.getRecent(p.limit)),
        pinTicket: (p) => wrap(() => svc.ticket.pin(p.ticketId)),
        unpinTicket: (p) => wrap(() => svc.ticket.unpin(p.ticketId)),
        markTicketRead: (p) => wrap(() => svc.ticket.markRead(p.ticketId)),
        markAllTicketsRead: (p) => wrap(() => svc.ticket.markAllRead(p.filter)),
        getUnreadCount: () => wrap(() => svc.ticket.getUnreadCount()),
        getPinnedTickets: () => wrap(() => svc.ticket.getPinned()),
        getTicketComments: (p) => wrap(() => svc.comment.getComments(p.ticketId)),
        getTicket: (p) => wrap(() => svc.ticket.getById(p.ticketId)),
        getGitlabImage: (p) => wrap(() => svc.comment.getImage(p.url)),
        syncTicketComments: (p) => wrap(() => svc.comment.syncComments(p.ticketId)),
        getProjects: () => wrap(() => svc.project.getAll()),

        // Booking
        bookEntry: (p) => wrap(() => svc.booking.bookEntry(p.entryId)),
        deleteBooking: (p) => wrap(() => svc.booking.deleteBooking(p.bookingId)),
        getBookingsForEntry: (p) => wrap(() => svc.booking.listForEntry(p.entryId)),
        getCommitsForDate: (p) => wrap(() => svc.commit.getForDate(p.date)),
        getDeadEvents: () => wrap(() => svc.events.getDead()),
        retryDeadEvent: (p) => wrap(() => svc.events.retryDead(p.eventId)),
        discardDeadEvent: (p) => wrap(() => svc.events.discardDead(p.eventId)),

        // Tags
        getTags: () => wrap(() => svc.tag.getAll()),
        createTag: (tag) => wrap(() => svc.tag.create(tag)),
        deleteTag: (p) => wrap(() => svc.tag.delete(p.id)),

        // Templates
        getTemplates: () => wrap(() => svc.template.getAll()),
        createTemplate: (t) => wrap(() => svc.template.create(t)),
        updateTemplate: (t) => wrap(() => svc.template.update(t)),
        deleteTemplate: (p) => wrap(() => svc.template.delete(p.id)),

        // Sync: stösst den Hintergrund-Sync an und kehrt sofort zurück
        // (Ergebnis kommt über syncCompleted/syncFailed-Events).
        triggerSync: () => wrap(() => svc.sync.triggerSync()),

        // Settings
        getSettings: () => wrap(() => svc.settings.get()),
        getCurrentUser: () => wrap(() => svc.settings.getCurrentUser()),
        saveSettings: (settings) => wrap(() => svc.settings.save(settings)),
        setGitLabToken: (p) => wrap(() => svc.settings.setToken(p.token)),
        backupDatabase: (p) => wrap(() => svc.settings.backup(p.destPath)),
      },
      messages: {},
    },
  });
}

export type AppRpc = ReturnType<typeof createRpc>;
