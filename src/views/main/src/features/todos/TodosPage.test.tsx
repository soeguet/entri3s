import { test, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../api";
import { keys } from "../../lib/queryKeys";
import { todoFixtures } from "../../fixtures/todos";
import { TodosPage } from "./TodosPage";

vi.mock("../../api");

const SETTINGS = { gitlabUrl: "", syncIntervalSec: 300, todoFolder: "/Vault/todos" };

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
  vi.mocked(api.getTodoLists).mockResolvedValue({ data: todoFixtures, error: null });
  vi.mocked(api.updateTodoTask).mockResolvedValue({ data: undefined, error: null });
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
