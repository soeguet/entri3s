import { test, expect } from "vitest";
import { labelTextColor } from "./labelColor";

test("wählt schwarze Schrift auf hellem Hintergrund", () => {
  expect(labelTextColor("#ffffff")).toBe("#000000");
  expect(labelTextColor("#fefefe")).toBe("#000000");
  expect(labelTextColor("#ffff00")).toBe("#000000"); // gelb ist hell
});

test("wählt weiße Schrift auf dunklem Hintergrund", () => {
  expect(labelTextColor("#000000")).toBe("#ffffff");
  expect(labelTextColor("#0033cc")).toBe("#ffffff");
  expect(labelTextColor("#cc0000")).toBe("#ffffff"); // sattes rot ist dunkel
});

test("akzeptiert Kurz-Hex und Werte ohne führendes #", () => {
  expect(labelTextColor("fff")).toBe("#000000");
  expect(labelTextColor("000")).toBe("#ffffff");
});

test("fällt bei ungültigem Wert auf weiß zurück", () => {
  expect(labelTextColor("not-a-color")).toBe("#ffffff");
  expect(labelTextColor("")).toBe("#ffffff");
});
