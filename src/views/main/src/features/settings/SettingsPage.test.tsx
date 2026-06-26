import { test, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../api";
import { SettingsPage } from "./SettingsPage";

vi.mock("../../api");

const SETTINGS = {
  gitlabUrl: "",
  syncIntervalSec: 300,
  todoFolder: "/Vault/todos",
  todoRemindersEnabled: true,
  reminderTime: "09:00",
};

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

test("Erinnerungszeit-Input ist an reminderTime gebunden und wird mitgespeichert", async () => {
  const user = userEvent.setup();
  // Abweichender Wert (nicht der Default 09:00), damit die Bindung an reminderTime
  // nachweisbar ist und nicht versehentlich der Initialwert geprüft wird.
  vi.mocked(api.getSettings).mockResolvedValue({
    data: { ...SETTINGS, reminderTime: "07:15" },
    error: null,
  });
  renderPage(freshClient());

  // Erst auf geladene Settings warten (Effekt befüllt die Felder); das Zeit-Input
  // hat keinen displayValue zum Anwarten, daher über das Ordner-Feld synchronisieren.
  await screen.findByDisplayValue("/Vault/todos");
  const input = screen.getByLabelText("Erinnerungszeit (täglich)") as HTMLInputElement;
  expect(input.type).toBe("time");
  expect(input.value).toBe("07:15");

  // Speichern reicht reminderTime unverändert an saveSettings durch (in der Form
  // verdrahtet). Das Tippen in native type="time"-Inputs ist in jsdom unzuverlässig;
  // die Bindung ist bereits über den geladenen Wert oben belegt.
  const todosCard = input.closest("div.rounded-lg") as HTMLElement;
  await user.click(within(todosCard).getByRole("button", { name: "Speichern" }));

  await vi.waitFor(() =>
    expect(api.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ reminderTime: "07:15" }),
    ),
  );
});
