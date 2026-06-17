import { test, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "../../lib/test-utils";
import * as api from "../../api";
import { EntryForm } from "./EntryForm";

vi.mock("../../api");

beforeEach(() => {
  vi.clearAllMocks();
});

test("zeigt Overlap-Fehler inline", async () => {
  vi.mocked(api.createEntry).mockResolvedValueOnce({
    data: null,
    error: { code: "OVERLAP", message: "Überschneidung", retry: false },
  });
  const user = userEvent.setup();
  renderWithClient(<EntryForm open onClose={() => {}} />);

  await user.type(screen.getByLabelText("Notizen"), "Neue Aufgabe");
  await user.click(screen.getByRole("button", { name: "Erstellen" }));

  expect(await screen.findByText("Überschneidung mit bestehendem Entry")).toBeInTheDocument();
});
