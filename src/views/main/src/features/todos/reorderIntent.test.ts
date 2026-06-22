import { describe, it, expect } from "vitest";
import { reorderIntent } from "./reorderIntent";

const ids = ["a", "b", "c", "d"];

describe("reorderIntent", () => {
  it("nach oben ziehen → before=true vor dem Ziel", () => {
    // c über a gezogen: c soll VOR a landen.
    expect(reorderIntent(ids, "c", "a")).toEqual({ targetId: "a", before: true });
  });

  it("nach unten ziehen → before=false hinter dem Ziel", () => {
    // a über d gezogen: a soll HINTER d landen.
    expect(reorderIntent(ids, "a", "d")).toEqual({ targetId: "d", before: false });
  });

  it("benachbart nach unten", () => {
    expect(reorderIntent(ids, "b", "c")).toEqual({ targetId: "c", before: false });
  });

  it("benachbart nach oben", () => {
    expect(reorderIntent(ids, "c", "b")).toEqual({ targetId: "b", before: true });
  });

  it("activeId === overId → null", () => {
    expect(reorderIntent(ids, "b", "b")).toBeNull();
  });

  it("unbekannte activeId → null", () => {
    expect(reorderIntent(ids, "x", "a")).toBeNull();
  });

  it("unbekannte overId → null", () => {
    expect(reorderIntent(ids, "a", "x")).toBeNull();
  });
});
