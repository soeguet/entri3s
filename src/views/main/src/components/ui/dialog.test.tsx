import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "./dialog";

test("Esc schliesst den offenen Dialog", async () => {
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(
    <Dialog open onClose={onClose}>
      <p>Inhalt</p>
    </Dialog>,
  );
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("ein geschlossener Dialog reagiert nicht auf Esc", async () => {
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(
    <Dialog open={false} onClose={onClose}>
      <p>Inhalt</p>
    </Dialog>,
  );
  expect(screen.queryByText("Inhalt")).not.toBeInTheDocument();
  await user.keyboard("{Escape}");
  expect(onClose).not.toHaveBeenCalled();
});

test("Focus-Trap: Tab vom letzten Element springt zum ersten", async () => {
  const user = userEvent.setup();
  render(
    <Dialog open onClose={() => {}}>
      <button>Erster</button>
      <button>Zweiter</button>
      <button>Letzter</button>
    </Dialog>,
  );

  const erster = screen.getByText("Erster");
  const letzter = screen.getByText("Letzter");

  // Fokus auf das letzte Element setzen.
  letzter.focus();
  expect(document.activeElement).toBe(letzter);

  // Tab sollte zum ersten Element zurückspringen.
  await user.keyboard("{Tab}");
  expect(document.activeElement).toBe(erster);
});

test("Focus-Trap: Shift+Tab vom ersten Element springt zum letzten", async () => {
  const user = userEvent.setup();
  render(
    <Dialog open onClose={() => {}}>
      <button>Erster</button>
      <button>Zweiter</button>
      <button>Letzter</button>
    </Dialog>,
  );

  const erster = screen.getByText("Erster");
  const letzter = screen.getByText("Letzter");

  // Fokus auf das erste Element setzen.
  erster.focus();
  expect(document.activeElement).toBe(erster);

  // Shift+Tab sollte zum letzten Element springen.
  await user.keyboard("{Shift>}{Tab}{/Shift}");
  expect(document.activeElement).toBe(letzter);
});

test("a11y: role=dialog und aria-modal=true sind gesetzt", () => {
  render(
    <Dialog open onClose={() => {}}>
      <p>Inhalt</p>
    </Dialog>,
  );
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveAttribute("aria-modal", "true");
});

test("a11y: aria-labelledby verweist auf den Titel", () => {
  render(
    <Dialog open onClose={() => {}} title="Testtitel">
      <p>Inhalt</p>
    </Dialog>,
  );
  const dialog = screen.getByRole("dialog");
  const labelledBy = dialog.getAttribute("aria-labelledby");
  expect(labelledBy).toBeTruthy();
  const heading = screen.getByText("Testtitel");
  expect(heading.id).toBe(labelledBy);
});

test("a11y: ohne title kein aria-labelledby", () => {
  render(
    <Dialog open onClose={() => {}}>
      <p>Inhalt</p>
    </Dialog>,
  );
  const dialog = screen.getByRole("dialog");
  expect(dialog).not.toHaveAttribute("aria-labelledby");
});
