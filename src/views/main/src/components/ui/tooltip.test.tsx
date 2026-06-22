import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tooltip } from "./tooltip";

// Positionierung (getBoundingClientRect) liefert in jsdom 0-Werte; wir testen
// nur die Sichtbarkeit des Inhalts, nicht die Pixel-Position.

test("content erscheint bei Hover und verschwindet wieder", async () => {
  const user = userEvent.setup();
  render(
    <Tooltip content={<span>Ticket-Titel</span>}>
      <button type="button">Trigger</button>
    </Tooltip>,
  );

  expect(screen.queryByText("Ticket-Titel")).not.toBeInTheDocument();

  await user.hover(screen.getByText("Trigger"));
  expect(screen.getByRole("tooltip")).toBeInTheDocument();
  expect(screen.getByText("Ticket-Titel")).toBeInTheDocument();

  await user.unhover(screen.getByText("Trigger"));
  expect(screen.queryByText("Ticket-Titel")).not.toBeInTheDocument();
});

test("Hover stört den Klick auf den Trigger-Button nicht", async () => {
  const onClick = vi.fn();
  const user = userEvent.setup();
  render(
    <Tooltip content={<span>Titel</span>}>
      <button type="button" onClick={onClick}>
        Trigger
      </button>
    </Tooltip>,
  );

  await user.click(screen.getByText("Trigger"));
  expect(onClick).toHaveBeenCalledTimes(1);
});
