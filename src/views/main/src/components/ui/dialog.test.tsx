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
