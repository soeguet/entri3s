import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TodoQuickAdd } from "./TodoQuickAdd";

test("Quick-Add ruft onAdd mit Titel, Priorität und Ziel-Liste", async () => {
  const onAdd = vi.fn();
  const user = userEvent.setup();
  render(<TodoQuickAdd listId="Arbeit" sections={["Heute"]} onAdd={onAdd} error={null} />);

  await user.type(screen.getByLabelText("Neue Aufgabe"), "Neuer Task");
  await user.selectOptions(screen.getByLabelText("Priorität"), "high");
  await user.click(screen.getByRole("button", { name: "Hinzufügen" }));

  expect(onAdd).toHaveBeenCalledWith(
    expect.objectContaining({ listId: "Arbeit", title: "Neuer Task", priority: "high" }),
  );
});

test("Quick-Add ist deaktiviert ohne Ziel-Liste", () => {
  render(<TodoQuickAdd listId={null} sections={[]} onAdd={vi.fn()} error={null} />);
  expect(screen.getByLabelText("Neue Aufgabe")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Hinzufügen" })).toBeDisabled();
});

test("Quick-Add behält die Eingabe bei einem Fehler (kein Reset)", async () => {
  const user = userEvent.setup();
  render(<TodoQuickAdd listId="Arbeit" sections={[]} onAdd={vi.fn()} error={null} />);
  const input = screen.getByLabelText("Neue Aufgabe");
  await user.type(input, "Bleibt erhalten");
  await user.click(screen.getByRole("button", { name: "Hinzufügen" }));
  // Komponente leert nicht selbst — der Aufrufer remountet erst nach Erfolg.
  expect(input).toHaveValue("Bleibt erhalten");
});
