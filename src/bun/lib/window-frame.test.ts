import { describe, expect, test } from "bun:test";
import { parseWindowFrame, type WindowFrame } from "./window-frame";

const FALLBACK: WindowFrame = { width: 1280, height: 800, x: 200, y: 200 };

describe("parseWindowFrame", () => {
  test("null → fallback", () => {
    expect(parseWindowFrame(null, FALLBACK)).toEqual(FALLBACK);
  });

  test("gültiger Frame → exakt geparst", () => {
    const raw = JSON.stringify({ x: 200, y: 200, width: 1280, height: 800 });
    expect(parseWindowFrame(raw, FALLBACK)).toEqual({ x: 200, y: 200, width: 1280, height: 800 });
  });

  test("Höhe 0 → fallback", () => {
    const raw = JSON.stringify({ x: 200, y: 200, width: 1280, height: 0 });
    expect(parseWindowFrame(raw, FALLBACK)).toEqual(FALLBACK);
  });

  test("Höhe/Breite zu klein → fallback", () => {
    const raw = JSON.stringify({ x: 200, y: 200, width: 1280, height: 30 });
    expect(parseWindowFrame(raw, FALLBACK)).toEqual(FALLBACK);
  });

  test("fehlende Felder → fallback", () => {
    const raw = JSON.stringify({ width: 1280, height: 800 });
    expect(parseWindowFrame(raw, FALLBACK)).toEqual(FALLBACK);
  });

  test("kaputtes JSON → fallback", () => {
    expect(parseWindowFrame("{not json", FALLBACK)).toEqual(FALLBACK);
  });
});
