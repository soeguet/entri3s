import { test, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../api";
import { keys } from "../../lib/queryKeys";
import { todoFixtures } from "../../fixtures/todos";
import { resetToasts } from "../../lib/toast";
import { Toaster } from "../../components/ui/toaster";
import { TodosPage } from "./TodosPage";

vi.mock("../../api");

const SETTINGS = {
  gitlabUrl: "",
  syncIntervalSec: 300,
  todoFolder: "/Vault/todos",
  todoRemindersEnabled: true,
};

function renderPage(client: QueryClient) {
  // Minimaler Router, weil TodosPage <Link to="/settings"> nutzt.
  const root = createRootRoute({ component: TodosPage });
  const settings = createRoute({
    getParentRoute: () => root,
    path: "/settings",
    component: () => null,
  });
  const router = createRouter({ routeTree: root.addChildren([settings]) });
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
      <Toaster />
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
  resetToasts();
  vi.mocked(api.getSettings).mockResolvedValue({ data: SETTINGS, error: null });
  vi.mocked(api.getTodoLists).mockResolvedValue({ data: todoFixtures, error: null });
  vi.mocked(api.updateTodoTask).mockResolvedValue({ data: undefined, error: null });
  vi.mocked(api.getTodoSavedFilters).mockResolvedValue({ data: "", error: null });
  vi.mocked(api.setTodoSavedFilters).mockResolvedValue({ data: undefined, error: null });
});

test("Empty State wenn todoFolder leer ist", async () => {
  vi.mocked(api.getSettings).mockResolvedValue({
    data: { ...SETTINGS, todoFolder: "" },
    error: null,
  });
  renderPage(freshClient());
  expect(await screen.findByText("Kein Todo-Ordner konfiguriert")).toBeInTheDocument();
});

test("Empty State wenn todoFolder im settings-Objekt fehlt (kein Crash)", async () => {
  vi.mocked(api.getSettings).mockResolvedValue({
    data: { gitlabUrl: "", syncIntervalSec: 300 } as never,
    error: null,
  });
  renderPage(freshClient());
  expect(await screen.findByText("Kein Todo-Ordner konfiguriert")).toBeInTheDocument();
});

test("Toggle ruft updateTodoTask und invalidiert die todos-Query (instant)", async () => {
  const client = freshClient();
  const spy = vi.spyOn(client, "invalidateQueries");
  const user = userEvent.setup();
  renderPage(client);

  // "Alle"-View ansteuern, damit der Task unabhängig vom heutigen Kalendertag
  // sichtbar ist (Default "Heute" hinge sonst am realen Datum) — und großzügiger
  // Timeout gegen Render-Flake unter Last.
  await user.click(await screen.findByRole("button", { name: /Alle/ }, { timeout: 3000 }));
  const checkbox = await screen.findByLabelText("OAuth-Redirect testen abhaken", undefined, {
    timeout: 3000,
  });
  await user.click(checkbox);

  await vi.waitFor(() =>
    expect(api.updateTodoTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: "Arbeit#0", listId: "Arbeit", done: true }),
    ),
  );
  await vi.waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: keys.todos() }));
});

test("Konflikt-UX: TODO_CONFLICT zeigt Spec-Meldung an der betroffenen Zeile", async () => {
  vi.mocked(api.updateTodoTask).mockResolvedValue({
    data: null,
    error: { code: "TODO_CONFLICT", message: "egal", retry: false },
  });
  const user = userEvent.setup();
  renderPage(freshClient());

  await user.click(await screen.findByRole("button", { name: /Alle/ }, { timeout: 3000 }));
  const checkbox = await screen.findByLabelText("OAuth-Redirect testen abhaken", undefined, {
    timeout: 3000,
  });
  await user.click(checkbox);

  expect(
    await screen.findByText("Aufgabe wurde extern geändert, nicht gespeichert", undefined, {
      timeout: 3000,
    }),
  ).toBeInTheDocument();
  // Die Aufgabe ist weiterhin sichtbar (Eingabe/Status nicht verworfen).
  expect(screen.getByText("OAuth-Redirect testen")).toBeInTheDocument();
});

test("Toolbar: Filtern nach Tag 'backend' zeigt nur passende Tasks", async () => {
  const user = userEvent.setup();
  renderPage(freshClient());

  // "Alle"-View, damit alle Tasks unabhängig vom heutigen Datum sichtbar sind.
  await user.click(await screen.findByRole("button", { name: /Alle/ }, { timeout: 3000 }));
  expect(
    await screen.findByText("OAuth-Redirect testen", undefined, { timeout: 3000 }),
  ).toBeInTheDocument();
  expect(screen.getByText("Release vorbereiten")).toBeInTheDocument();

  // Tags-Popover öffnen und die "backend"-Checkbox aktivieren.
  await user.click(await screen.findByRole("button", { name: /^Tags/ }, { timeout: 3000 }));
  await user.click(await screen.findByLabelText("backend", undefined, { timeout: 3000 }));

  // Nur der Task mit Tag "backend" bleibt sichtbar.
  await vi.waitFor(() => expect(screen.queryByText("Release vorbereiten")).not.toBeInTheDocument());
  expect(screen.getByText("OAuth-Redirect testen")).toBeInTheDocument();
});

test("Saved Filter: 'backend'-Tag-Filter speichern, neu laden, anwenden filtert die Liste", async () => {
  const user = userEvent.setup();
  const client = freshClient();
  renderPage(client);

  // "Alle"-View + backend-Tag aktivieren, damit ein nicht-trivialer Filter aktiv ist.
  await user.click(await screen.findByRole("button", { name: /Alle/ }, { timeout: 3000 }));
  await user.click(await screen.findByRole("button", { name: /^Tags/ }, { timeout: 3000 }));
  await user.click(await screen.findByLabelText("backend", undefined, { timeout: 3000 }));

  // Filter unter einem Namen speichern.
  await user.type(await screen.findByLabelText("Filter speichern"), "Backend");
  await user.click(screen.getByRole("button", { name: "Filter sichern" }));

  // setTodoSavedFilters wurde mit serialisiertem Inhalt (inkl. backend-Tag) aufgerufen.
  await vi.waitFor(() => expect(api.setTodoSavedFilters).toHaveBeenCalledTimes(1));
  const json = vi.mocked(api.setTodoSavedFilters).mock.calls[0][0] as string;
  expect(json).toContain("backend");
  expect(json).toContain("Backend");

  // Persistenz simulieren: nächster Reload liefert genau diesen String zurück.
  vi.mocked(api.getTodoSavedFilters).mockResolvedValue({ data: json, error: null });
  client.invalidateQueries({ queryKey: keys.todoSavedFilters() });

  // Filter zurücksetzen, dann über den gespeicherten Eintrag erneut anwenden.
  await user.click(await screen.findByRole("button", { name: /Zurücksetzen/ }, { timeout: 3000 }));
  await vi.waitFor(() => expect(screen.getByText("Release vorbereiten")).toBeInTheDocument());

  await user.click(await screen.findByRole("button", { name: "Backend" }, { timeout: 3000 }));

  // Anwenden filtert wieder: nur der backend-Task bleibt sichtbar.
  await vi.waitFor(() => expect(screen.queryByText("Release vorbereiten")).not.toBeInTheDocument());
  expect(screen.getByText("OAuth-Redirect testen")).toBeInTheDocument();
});

test("Bulk: zwei Tasks auswählen und abhaken ruft updateTodoTask für beide mit done:true", async () => {
  const user = userEvent.setup();
  renderPage(freshClient());

  // "Alle"-View, damit die Tasks unabhängig vom heutigen Datum sichtbar sind.
  await user.click(await screen.findByRole("button", { name: /Alle/ }, { timeout: 3000 }));

  // Auswahl-Modus aktivieren.
  await user.click(await screen.findByRole("button", { name: "Auswählen" }, { timeout: 3000 }));

  // Zwei Tasks über die Auswahl-Checkboxen markieren.
  const checkboxes = await screen.findAllByLabelText("Auswählen", undefined, { timeout: 3000 });
  await user.click(checkboxes[0]);
  await user.click(checkboxes[1]);

  // Bulk-Leiste erscheint → "Abhaken".
  await user.click(await screen.findByRole("button", { name: /Abhaken/ }, { timeout: 3000 }));

  await vi.waitFor(() => expect(api.updateTodoTask).toHaveBeenCalledTimes(2));
  for (const call of vi.mocked(api.updateTodoTask).mock.calls) {
    expect(call[0]).toEqual(expect.objectContaining({ done: true }));
  }
});

test("Abhaken eines normalen Tasks zeigt Undo-Toast, Klick auf Rückgängig setzt done:false", async () => {
  const user = userEvent.setup();
  renderPage(freshClient());

  await user.click(await screen.findByRole("button", { name: /Alle/ }, { timeout: 3000 }));
  await user.click(
    await screen.findByLabelText("OAuth-Redirect testen abhaken", undefined, { timeout: 3000 }),
  );

  const undo = await screen.findByRole("button", { name: "Rückgängig" }, { timeout: 3000 });
  await user.click(undo);

  await vi.waitFor(() =>
    expect(api.updateTodoTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: "Arbeit#0", listId: "Arbeit", done: false }),
    ),
  );
});

test("Abhaken eines wiederkehrenden Tasks zeigt KEINEN Undo-Toast", async () => {
  const user = userEvent.setup();
  renderPage(freshClient());

  // In die Privat-Liste wechseln, dort steht der wiederkehrende Task.
  await user.click(await screen.findByRole("button", { name: "Privat" }, { timeout: 3000 }));
  await user.click(
    await screen.findByLabelText("Wöchentlich Müll rausbringen abhaken", undefined, {
      timeout: 3000,
    }),
  );

  await vi.waitFor(() =>
    expect(api.updateTodoTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: "Privat#0", done: true }),
    ),
  );
  expect(screen.queryByRole("button", { name: "Rückgängig" })).not.toBeInTheDocument();
});
