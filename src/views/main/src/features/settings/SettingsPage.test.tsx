import { test, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../api";
import { SettingsPage } from "./SettingsPage";

vi.mock("../../api");

const SETTINGS = { gitlabUrl: "", syncIntervalSec: 300, todoFolder: "/Vault/todos" };

function renderPage(client: QueryClient) {
  // SettingsPage nutzt keinen <Link>, daher kein Router nötig.
  return render(
    <QueryClientProvider client={client}>
      <SettingsPage />
    </QueryClientProvider>,
  );
}

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getSettings).mockResolvedValue({ data: SETTINGS, error: null });
  vi.mocked(api.saveSettings).mockResolvedValue({ data: undefined, error: null });
});

test("Todos-Speichern ruft saveSettings mit todoFolder und zeigt Gespeichert", async () => {
  const user = userEvent.setup();
  renderPage(freshClient());

  // Auf befülltes Input warten (Settings geladen), dann den Button der Todos-Karte klicken.
  const input = await screen.findByDisplayValue("/Vault/todos");

  const todosCard = input.closest("div.rounded-lg") as HTMLElement;
  await user.click(within(todosCard).getByRole("button", { name: "Speichern" }));

  await vi.waitFor(() =>
    expect(api.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ todoFolder: "/Vault/todos" }),
    ),
  );
  expect(await within(todosCard).findByText("Gespeichert")).toBeInTheDocument();
});
