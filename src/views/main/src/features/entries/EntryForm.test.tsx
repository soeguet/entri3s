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

test("legt einen Entry an und schliesst das Formular", async () => {
  vi.mocked(api.createEntry).mockResolvedValueOnce({ data: 1, error: null });
  const onClose = vi.fn();
  const user = userEvent.setup();
  renderWithClient(<EntryForm open onClose={onClose} />);

  await user.type(screen.getByLabelText("Notizen"), "Neue Aufgabe");
  await user.click(screen.getByRole("button", { name: "Erstellen" }));

  await vi.waitFor(() => expect(api.createEntry).toHaveBeenCalled());
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
});
