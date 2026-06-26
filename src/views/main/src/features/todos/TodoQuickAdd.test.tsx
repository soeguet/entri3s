import { test, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TodoQuickAdd } from "./TodoQuickAdd";

const TODAY = "2026-06-22"; // Montag

const LISTS = [
  { id: "Arbeit", name: "Arbeit", sections: ["Heute", "Diese Woche"] },
  { id: "Privat", name: "Privat", sections: [] },
  { id: "Arbeit 2026", name: "Arbeit 2026", sections: ["Q1"] },
];

test("Quick-Add parst Natural-Language und ruft onAdd mit den Feldern", async () => {
  const onAdd = vi.fn();
  const user = userEvent.setup();
  render(<TodoQuickAdd lists={LISTS} listId="Arbeit" today={TODAY} onAdd={onAdd} error={null} />);

  await user.type(screen.getByLabelText("Neue Aufgabe"), "Angebot schreiben @morgen #arbeit p1");
  await user.click(screen.getByRole("button", { name: "Hinzufügen" }));

  expect(onAdd).toHaveBeenCalledWith(
    {
      listId: "Arbeit",
      title: "Angebot schreiben",
      priority: "highest",
      due: "2026-06-23",
      tags: ["arbeit"],
    },
    false,
  );
});

test("Quick-Add zeigt Preview-Chips für erkanntes Due, Priorität und #tags", async () => {
  const user = userEvent.setup();
  render(<TodoQuickAdd lists={LISTS} listId="Arbeit" today={TODAY} onAdd={vi.fn()} error={null} />);

  await user.type(screen.getByLabelText("Neue Aufgabe"), "Angebot @morgen #arbeit p1");

  const chips = screen.getByLabelText("Erkannt");
  expect(chips).toHaveTextContent("2026-06-23");
  expect(chips).toHaveTextContent("Höchste");
  expect(chips).toHaveTextContent("#arbeit");
});

test("Quick-Add ist deaktiviert ohne Ziel-Liste", () => {
  render(<TodoQuickAdd lists={[]} listId={null} today={TODAY} onAdd={vi.fn()} error={null} />);
  expect(screen.getByLabelText("Neue Aufgabe")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Hinzufügen" })).toBeDisabled();
});

test("Quick-Add behält die Eingabe bei einem Fehler (kein Reset)", async () => {
  const user = userEvent.setup();
  render(<TodoQuickAdd lists={LISTS} listId="Arbeit" today={TODAY} onAdd={vi.fn()} error={null} />);
  const input = screen.getByLabelText("Neue Aufgabe");
  await user.type(input, "Bleibt erhalten");
  await user.click(screen.getByRole("button", { name: "Hinzufügen" }));
  // Komponente leert nicht selbst — der Aufrufer remountet erst nach Erfolg.
  expect(input).toHaveValue("Bleibt erhalten");
});

test("&-Token öffnet nicht-modales Dropdown (kein aria-modal/Focus-Trap)", async () => {
  const user = userEvent.setup();
  render(<TodoQuickAdd lists={LISTS} listId="Arbeit" today={TODAY} onAdd={vi.fn()} error={null} />);

  await user.type(screen.getByLabelText("Neue Aufgabe"), "Termin &Pri");
  const dropdown = await screen.findByLabelText("Listen-Vorschläge");
  expect(within(dropdown).getByRole("option", { name: "Privat" })).toBeInTheDocument();
  // NICHT modal: kein aria-modal im DOM → Page-Hotkeys/Fokus bleiben aktiv.
  expect(document.querySelector('[aria-modal="true"]')).toBeNull();
  // Fokus bleibt im Quick-Add-Input.
  expect(screen.getByLabelText("Neue Aufgabe")).toHaveFocus();
});

test("Pfeiltasten + Enter wählen eine Liste, Chip erscheint, Submit nutzt die Ziel-Liste", async () => {
  const onAdd = vi.fn();
  const user = userEvent.setup();
  render(<TodoQuickAdd lists={LISTS} listId="Arbeit" today={TODAY} onAdd={onAdd} error={null} />);

  const input = screen.getByLabelText("Neue Aufgabe");
  await user.type(input, "Müll &Pri");
  await screen.findByLabelText("Listen-Vorschläge");
  // Erste (einzige) Match-Liste ist "Privat" → Enter wählt sie.
  await user.keyboard("{Enter}");

  // Chip "→ Privat" sichtbar (Ziel ≠ Default "Arbeit").
  expect(screen.getByLabelText("Erkannt")).toHaveTextContent("→ Privat");

  await user.click(screen.getByRole("button", { name: "Hinzufügen" }));
  expect(onAdd).toHaveBeenCalledWith(
    expect.objectContaining({ listId: "Privat", title: "Müll" }),
    true,
  );
});

test("Esc schließt nur das Dropdown; der Token bleibt im Titel", async () => {
  const user = userEvent.setup();
  render(<TodoQuickAdd lists={LISTS} listId="Arbeit" today={TODAY} onAdd={vi.fn()} error={null} />);

  const input = screen.getByLabelText("Neue Aufgabe");
  await user.type(input, "Termin &Pri");
  await screen.findByLabelText("Listen-Vorschläge");
  await user.keyboard("{Escape}");

  expect(screen.queryByLabelText("Listen-Vorschläge")).not.toBeInTheDocument();
  // Token bleibt erhalten; App/Submit unberührt.
  expect(input).toHaveValue("Termin &Pri");
});

test("Section wird bei Ziel-Wechsel gegen die Ziel-Liste revalidiert", async () => {
  const onAdd = vi.fn();
  const user = userEvent.setup();
  render(<TodoQuickAdd lists={LISTS} listId="Arbeit" today={TODAY} onAdd={onAdd} error={null} />);

  // Arbeit-Sektion "Heute" wählen.
  await user.selectOptions(screen.getByLabelText("Sektion"), "Heute");
  await user.type(screen.getByLabelText("Neue Aufgabe"), "Task &Pri");
  await screen.findByLabelText("Listen-Vorschläge");
  await user.keyboard("{Enter}"); // Privat hat KEINE Sektionen

  await user.click(screen.getByRole("button", { name: "Hinzufügen" }));
  // "Heute" gehört nicht zu Privat → keine section im Input (kein Strukturmüll).
  const call = onAdd.mock.calls[0][0];
  expect(call.section).toBeUndefined();
  expect(call.listId).toBe("Privat");
});

test("Auto-due-Hinweis: explizite Liste meldet hadExplicitList=true an onAdd", async () => {
  const onAdd = vi.fn();
  const user = userEvent.setup();
  render(<TodoQuickAdd lists={LISTS} listId="Arbeit" today={TODAY} onAdd={onAdd} error={null} />);

  // Exact-Match via Token (ohne Dropdown-Auswahl) → hadExplicitList=true.
  await user.type(screen.getByLabelText("Neue Aufgabe"), "Task &Privat");
  await user.click(screen.getByRole("button", { name: "Hinzufügen" }));
  expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ listId: "Privat" }), true);
});

test("unbekanntes &xyz: Dropdown leer, Submit fällt auf Fallback zurück", async () => {
  const onAdd = vi.fn();
  const user = userEvent.setup();
  render(<TodoQuickAdd lists={LISTS} listId="Arbeit" today={TODAY} onAdd={onAdd} error={null} />);

  await user.type(screen.getByLabelText("Neue Aufgabe"), "Task &Zzz");
  // Kein Match → kein Dropdown.
  expect(screen.queryByLabelText("Listen-Vorschläge")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Hinzufügen" }));
  // Token bleibt im Titel, Ziel = Fallback "Arbeit", hadExplicitList=false.
  expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ listId: "Arbeit" }), false);
});
