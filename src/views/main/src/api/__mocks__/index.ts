import { vi } from "vitest";
import { fixtures } from "../../fixtures";

// Manueller Mock für Vitest. Tests aktivieren ihn via `vi.mock('../../api')`
// und überschreiben einzelne Funktionen nach Bedarf.
const okResp = <T>(data: T) => Promise.resolve({ data, error: null });
const voidResp = () => Promise.resolve({ data: undefined, error: null });

export const getEntries = vi.fn(() => okResp(fixtures.entries));
export const getEntry = vi.fn((id: number) =>
  okResp(fixtures.entries.find((e) => e.id === id) ?? fixtures.entries[0]),
);
export const createEntry = vi.fn(() => okResp(1));
export const updateEntry = vi.fn(voidResp);
export const deleteEntry = vi.fn(voidResp);
export const assignTicket = vi.fn(voidResp);
export const removeTicket = vi.fn(voidResp);
export const getTickets = vi.fn(() => okResp(fixtures.tickets));
export const bookEntry = vi.fn(voidResp);
export const deleteBooking = vi.fn(voidResp);
export const getBookingsForEntry = vi.fn(() => okResp(fixtures.bookings));
export const getDeadEvents = vi.fn(() => okResp([]));
export const retryDeadEvent = vi.fn(voidResp);
export const getTags = vi.fn(() => okResp(fixtures.tags));
export const createTag = vi.fn(() => okResp(1));
export const deleteTag = vi.fn(voidResp);
export const getTemplates = vi.fn(() => okResp(fixtures.templates));
export const createTemplate = vi.fn(() => okResp(1));
export const updateTemplate = vi.fn(voidResp);
export const deleteTemplate = vi.fn(voidResp);
export const triggerSync = vi.fn(voidResp);
export const getSettings = vi.fn(() =>
  okResp({ gitlabUrl: "https://gitlab.example.com", projectId: 42, syncIntervalSec: 300 }),
);
export const saveSettings = vi.fn(voidResp);
export const setGitLabToken = vi.fn(voidResp);
export const backupDatabase = vi.fn(voidResp);
