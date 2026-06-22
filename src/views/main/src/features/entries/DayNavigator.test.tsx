import { test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DayNavigator } from "./DayNavigator";
import { shiftDay, todayBerlinYmd } from "../../lib/dates";

test("Klick auf › verschiebt Einzeltag um +1", () => {
  const onDay = vi.fn();
  render(<DayNavigator from="2026-06-16" to="2026-06-16" onDay={onDay} />);

  fireEvent.click(screen.getByRole("button", { name: "Tag vor" }));
  expect(onDay).toHaveBeenCalledWith("2026-06-17");
});

test("Klick auf ‹ verschiebt Einzeltag um -1", () => {
  const onDay = vi.fn();
  render(<DayNavigator from="2026-06-16" to="2026-06-16" onDay={onDay} />);

  fireEvent.click(screen.getByRole("button", { name: "Tag zurück" }));
  expect(onDay).toHaveBeenCalledWith("2026-06-15");
});

test("bei leerem from/to fällt Pfeil-Navigation auf heute zurück", () => {
  const onDay = vi.fn();
  render(<DayNavigator from="" to="" onDay={onDay} />);

  fireEvent.click(screen.getByRole("button", { name: "Tag vor" }));
  expect(onDay).toHaveBeenCalledWith(shiftDay(todayBerlinYmd(), 1));
});

test("Heute-Button ruft onDay mit heutigem Datum", () => {
  const onDay = vi.fn();
  render(<DayNavigator from="2026-06-16" to="2026-06-16" onDay={onDay} />);

  fireEvent.click(screen.getByRole("button", { name: "Heute" }));
  expect(onDay).toHaveBeenCalledWith(todayBerlinYmd());
});
