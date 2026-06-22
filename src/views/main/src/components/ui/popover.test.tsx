import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Popover } from "./popover";

function createAnchor(): HTMLElement {
  const btn = document.createElement("button");
  btn.textContent = "Anker";
  document.body.appendChild(btn);
  return btn;
}

test("open + anchor: children werden gerendert", () => {
  const anchor = createAnchor();
  render(
    <Popover open anchor={anchor} onClose={() => {}}>
      <p>Popover-Inhalt</p>
    </Popover>,
  );
  expect(screen.getByText("Popover-Inhalt")).toBeInTheDocument();
  anchor.remove();
});

test("open=false: children nicht im DOM", () => {
  const anchor = createAnchor();
  render(
    <Popover open={false} anchor={anchor} onClose={() => {}}>
      <p>Popover-Inhalt</p>
    </Popover>,
  );
  expect(screen.queryByText("Popover-Inhalt")).not.toBeInTheDocument();
  anchor.remove();
});

test("Escape ruft onClose", async () => {
  const onClose = vi.fn();
  const anchor = createAnchor();
  const user = userEvent.setup();
  render(
    <Popover open anchor={anchor} onClose={onClose}>
      <p>Popover-Inhalt</p>
    </Popover>,
  );
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
  anchor.remove();
});

test("Klick ausserhalb ruft onClose, Klick innerhalb nicht", async () => {
  const onClose = vi.fn();
  const anchor = createAnchor();
  const user = userEvent.setup();
  render(
    <Popover open anchor={anchor} onClose={onClose}>
      <button>Innen</button>
    </Popover>,
  );

  // Klick innerhalb des Popovers darf onClose NICHT aufrufen.
  await user.click(screen.getByText("Innen"));
  expect(onClose).not.toHaveBeenCalled();

  // Klick auf den Anker-Button selbst darf onClose ebenfalls NICHT aufrufen.
  await user.click(anchor);
  expect(onClose).not.toHaveBeenCalled();

  // Klick ausserhalb (auf document.body hinter dem Portal).
  // userEvent.click feuert mousedown + mouseup + click. Wir brauchen mousedown.
  const outside = document.createElement("div");
  outside.textContent = "Aussen";
  document.body.appendChild(outside);
  await user.click(outside);
  expect(onClose).toHaveBeenCalledTimes(1);

  outside.remove();
  anchor.remove();
});

// Positionierung (getBoundingClientRect-abhaengig) laesst sich in jsdom nicht
// sinnvoll testen, da jsdom keine echten Layout-Masse liefert (alle Werte = 0).

test("a11y: role=dialog und aria-modal=true", () => {
  const anchor = createAnchor();
  render(
    <Popover open anchor={anchor} onClose={() => {}}>
      <p>Inhalt</p>
    </Popover>,
  );
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveAttribute("aria-modal", "true");
  anchor.remove();
});
