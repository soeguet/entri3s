import { test, expect } from "vitest";
import { repairBridgeEncoding } from "./bridgeEncoding";

// Reproduziert die Brücken-Korruption exakt: UTF-8-kodieren, jedes Byte b >= 0x80
// per signed-char-Widening auf die Code-Unit (0xFF00 | b) abbilden.
function corrupt(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let result = "";
  for (const b of bytes) {
    result += String.fromCharCode(b < 0x80 ? b : 0xff00 | b);
  }
  return result;
}

test("stellt einzelne Umlaute wieder her", () => {
  expect(repairBridgeEncoding(corrupt("ü"))).toBe("ü");
  expect(repairBridgeEncoding(corrupt("ä"))).toBe("ä");
  expect(repairBridgeEncoding(corrupt("ö"))).toBe("ö");
});

test("stellt Umlaute innerhalb eines Wortes wieder her", () => {
  expect(repairBridgeEncoding(corrupt("für"))).toBe("für");
});

test("stellt einen realen Satzteil exakt wieder her", () => {
  const text = "Sammelticket für alle Tätigkeiten, die zur zukünftigen Umsatzgenerierung";
  expect(repairBridgeEncoding(corrupt(text))).toBe(text);
});

test("stellt Multibyte-Zeichen wie das Euro-Symbol wieder her", () => {
  expect(repairBridgeEncoding(corrupt("100 €"))).toBe("100 €");
});

test("lässt reine ASCII-Strings unverändert (gleiche Referenz)", () => {
  const ascii = "plain ascii string 123";
  expect(repairBridgeEncoding(ascii)).toBe(ascii);
});

test("lässt bereits korrektes Unicode unverändert (forward-compat)", () => {
  expect(repairBridgeEncoding("Müller")).toBe("Müller");
});

test("repariert verschachtelte Strukturen tief und lässt Nicht-Strings unverändert", () => {
  const input = {
    title: corrupt("Übersicht"),
    count: 42,
    active: true,
    note: null,
    items: [
      { label: corrupt("Größe"), value: 7 },
      { label: corrupt("Tätigkeit"), value: false },
    ],
  };
  const result = repairBridgeEncoding(input);
  expect(result.title).toBe("Übersicht");
  expect(result.count).toBe(42);
  expect(result.active).toBe(true);
  expect(result.note).toBe(null);
  expect(result.items[0].label).toBe("Größe");
  expect(result.items[0].value).toBe(7);
  expect(result.items[1].label).toBe("Tätigkeit");
  expect(result.items[1].value).toBe(false);
});
