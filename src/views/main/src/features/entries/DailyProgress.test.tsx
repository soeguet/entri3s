import { test, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithClient } from "../../lib/test-utils";
import type { Entry } from "../../../../../shared/types";
import * as api from "../../api";
import { DailyProgress } from "./DailyProgress";

vi.mock("../../api");

beforeEach(() => {
  vi.clearAllMocks();
});

function todayEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 10,
    notes: "Standup",
    durationMinutes: 120,
    date: new Date(Date.now() - 120 * 60_000).toISOString(),
    status: "draft",
    tagIds: [],
    ticketIds: [],
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

test("rendert nichts ohne heutige Entries", async () => {
  vi.mocked(api.getEntries).mockResolvedValue({ data: [], error: null });
  vi.mocked(api.getRunningEntry).mockResolvedValue({ data: null, error: null });
  const { container } = renderWithClient(<DailyProgress />);

  await vi.waitFor(() => expect(api.getEntries).toHaveBeenCalled());
  expect(container.textContent).toBe("");
});

test("zeigt Tagesfortschritt bei vorhandenen Entries", async () => {
  vi.mocked(api.getEntries).mockResolvedValue({
    data: [todayEntry({ durationMinutes: 300 })],
    error: null,
  });
  vi.mocked(api.getRunningEntry).mockResolvedValue({ data: null, error: null });
  renderWithClient(<DailyProgress />);

  await screen.findByText("5h");
  expect(screen.getByText("noch 3h")).toBeInTheDocument();
});

test("zeigt Tagesziel erreicht bei >= 8h", async () => {
  vi.mocked(api.getEntries).mockResolvedValue({
    data: [todayEntry({ durationMinutes: 480 })],
    error: null,
  });
  vi.mocked(api.getRunningEntry).mockResolvedValue({ data: null, error: null });
  renderWithClient(<DailyProgress />);

  await screen.findByText("8h");
  expect(screen.getByText("Tagesziel erreicht")).toBeInTheDocument();
});

test("rechnet laufenden Timer in den Fortschritt ein", async () => {
  const running: Entry = {
    id: 11,
    notes: null,
    durationMinutes: 0,
    date: new Date(Date.now() - 60 * 60_000).toISOString(),
    status: "running",
    tagIds: [],
    ticketIds: [],
    createdAt: "",
    updatedAt: "",
  };
  vi.mocked(api.getEntries).mockResolvedValue({
    data: [todayEntry({ durationMinutes: 360 })],
    error: null,
  });
  vi.mocked(api.getRunningEntry).mockResolvedValue({ data: running, error: null });
  renderWithClient(<DailyProgress />);

  await screen.findByText("7h");
  expect(screen.getByText("noch 1h")).toBeInTheDocument();
});
