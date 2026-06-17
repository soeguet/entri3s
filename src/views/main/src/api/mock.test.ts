import { describe, it, expect } from "vitest";
import { getEntries } from "./mock";

// Fixtures (siehe src/fixtures): Entry 1 → Ticket 1 (Projekt 42),
// Entry 3 → Ticket 2 (Projekt 42), Entry 4 → Ticket 1, Entry 2 → kein Ticket.
async function ids(filter: Parameters<typeof getEntries>[0]): Promise<number[]> {
  const res = await getEntries(filter);
  return (res.data ?? []).map((e) => e.id).sort((a, b) => a - b);
}

describe("mock getEntries Hierarchie-Filter", () => {
  it("ticketIds: Entry enthält mindestens eines der Tickets", async () => {
    expect(await ids({ ticketIds: [2] })).toEqual([3]);
  });

  it("projectIds: Tickets des Entries gehören zu einem der Projekte", async () => {
    // Projekt 42 = Tickets 1 & 2 → Entries 1, 3, 4.
    expect(await ids({ projectIds: [42] })).toEqual([1, 3, 4]);
  });

  it("projectIds ODER ticketIds innerhalb des Picker-Blocks", async () => {
    // Projekt 43 (keiner) ODER Ticket 2 (Entry 3).
    expect(await ids({ projectIds: [43], ticketIds: [2] })).toEqual([3]);
  });

  it("Picker-Block UND-verknüpft mit Status", async () => {
    expect(await ids({ projectIds: [42], status: "draft" })).toEqual([1]);
  });

  it("leere Arrays filtern nicht", async () => {
    const all = await ids({});
    expect(await ids({ projectIds: [], ticketIds: [] })).toEqual(all);
  });
});
