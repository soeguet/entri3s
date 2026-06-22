import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TodoQuickAdd } from "./TodoQuickAdd";

const TODAY = "2026-06-22"; // Montag

test("Quick-Add parst Natural-Language und ruft onAdd mit den Feldern", async () => {
  const onAdd = vi.fn();
  const user = userEvent.setup();
  render(
    <TodoQuickAdd listId="Arbeit" sections={["Heute"]} today={TODAY} onAdd={onAdd} error={null} />,
  );

  await user.type(screen.getByLabelText("Neue Aufgabe"), "Angebot schreiben morgen #arbeit p1");
  await user.click(screen.getByRole("button", { name: "Hinzufügen" }));

  expect(onAdd).toHaveBeenCalledWith({
    listId: "Arbeit",
    title: "Angebot schreiben",
    priority: "highest",
    due: "2026-06-23",
    tags: ["arbeit"],
  });
});

test("Quick-Add zeigt Preview-Chips für erkanntes Due, Priorität und #tags", async () => {
  const user = userEvent.setup();
  render(<TodoQuickAdd listId="Arbeit" sections={[]} today={TODAY} onAdd={vi.fn()} error={null} />);

  await user.type(screen.getByLabelText("Neue Aufgabe"), "Angebot morgen #arbeit p1");

  const chips = screen.getByLabelText("Erkannt");
  expect(chips).toHaveTextContent("2026-06-23");
  expect(chips).toHaveTextContent("Höchste");
  expect(chips).toHaveTextContent("#arbeit");
});

test("Quick-Add ist deaktiviert ohne Ziel-Liste", () => {
  render(<TodoQuickAdd listId={null} sections={[]} today={TODAY} onAdd={vi.fn()} error={null} />);
  expect(screen.getByLabelText("Neue Aufgabe")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Hinzufügen" })).toBeDisabled();
});

test("Quick-Add behält die Eingabe bei einem Fehler (kein Reset)", async () => {
  const user = userEvent.setup();
  render(<TodoQuickAdd listId="Arbeit" sections={[]} today={TODAY} onAdd={vi.fn()} error={null} />);
  const input = screen.getByLabelText("Neue Aufgabe");
  await user.type(input, "Bleibt erhalten");
  await user.click(screen.getByRole("button", { name: "Hinzufügen" }));
  // Komponente leert nicht selbst — der Aufrufer remountet erst nach Erfolg.
  expect(input).toHaveValue("Bleibt erhalten");
});
