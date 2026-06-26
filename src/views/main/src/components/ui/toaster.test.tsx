import { test, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "./toaster";
import { toast, resetToasts } from "../../lib/toast";

beforeEach(() => {
  resetToasts();
});

test("rendert einen Toast nach toast.success(...)", async () => {
  render(<Toaster />);
  toast.success("Gespeichert");
  expect(await screen.findByText("Gespeichert")).toBeInTheDocument();
});

test("Klick auf den Toast entfernt ihn", async () => {
  const user = userEvent.setup();
  render(<Toaster />);
  toast.error("Etwas ging schief");

  const item = await screen.findByText("Etwas ging schief");
  await user.click(item);
  expect(screen.queryByText("Etwas ging schief")).not.toBeInTheDocument();
});

test("Action-Button rendert und ruft onAction + entfernt den Toast", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  render(<Toaster />);
  toast.success("Erledigt: Foo", { label: "Rückgängig", onAction });

  const button = await screen.findByRole("button", { name: "Rückgängig" });
  await user.click(button);

  expect(onAction).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Erledigt: Foo")).not.toBeInTheDocument();
});

test("Body-Klick neben dem Button verwirft nur (kein onAction)", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  render(<Toaster />);
  toast.success("Erledigt: Foo", { label: "Rückgängig", onAction });

  const message = await screen.findByText("Erledigt: Foo");
  await user.click(message);

  expect(onAction).not.toHaveBeenCalled();
  expect(screen.queryByText("Erledigt: Foo")).not.toBeInTheDocument();
});
