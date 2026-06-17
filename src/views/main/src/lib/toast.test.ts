import { test, expect, vi, beforeEach } from "vitest";
import { toast, getSnapshot, dismissToast, resetToasts } from "./toast";

beforeEach(() => {
  resetToasts();
  vi.useRealTimers();
});

test("ein emittierter Toast erscheint im Snapshot", () => {
  toast.success("Gebucht");
  const snap = getSnapshot();
  expect(snap).toHaveLength(1);
  expect(snap[0].variant).toBe("success");
  expect(snap[0].message).toBe("Gebucht");
});

test("verschiedene Varianten werden korrekt gesetzt", () => {
  toast.error("Fehler");
  toast.info("Info");
  const snap = getSnapshot();
  expect(snap.map((t) => t.variant)).toEqual(["error", "info"]);
});

test("dismissToast entfernt den Toast", () => {
  const id = toast.success("weg gleich");
  expect(getSnapshot()).toHaveLength(1);
  dismissToast(id);
  expect(getSnapshot()).toHaveLength(0);
});

test("Auto-Dismiss nach ~4s entfernt den Toast", () => {
  vi.useFakeTimers();
  toast.info("verschwindet");
  expect(getSnapshot()).toHaveLength(1);
  vi.advanceTimersByTime(4000);
  expect(getSnapshot()).toHaveLength(0);
});
