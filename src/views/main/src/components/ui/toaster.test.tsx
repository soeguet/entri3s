import { test, expect, beforeEach } from "vitest";
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
