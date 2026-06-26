import { applyTaskEdit } from "./serializer";
import { blockRange } from "./reorder";
import type { ParsedList } from "./parser";

// Kaskadierendes Abhaken: gibt eine Kopie von lines zurück, in der alle offenen
// Subtasks im blockRange-Subtree des Parents (Zeilenindex idx) mit-erledigt sind
// (✅ today). blockRange.end ist EXKLUSIV und enthält auch Beschreibungs-Zeilen —
// daher NUR Task-Zeilen aus parsed.raw mit lineIndex im Block anfassen, nie
// Description-Zeilen. recurring Kinder (recurrence !== null) werden KOMPLETT
// übersprungen: sie behalten ihren eigenen Lebenszyklus; stilles Abhaken ohne
// Folgeinstanz wäre inkonsistent. Folgeinstanzen für Kinder sind explizit Phase 2.
// Bereits erledigte Kinder bleiben unverändert (kein doppeltes ✅).
export function completeOpenDescendants(
  lines: string[],
  parsed: ParsedList,
  idx: number,
  today: string,
): string[] {
  const hit = parsed.raw.find((r) => r.lineIndex === idx)!;
  const block = blockRange(lines, parsed.raw, hit);
  const children = parsed.raw.filter(
    (r) => r.lineIndex > idx && r.lineIndex < block.end && r.task.recurrence === null,
  );
  const out = [...lines];
  for (const c of children) {
    if (!c.task.done) {
      out[c.lineIndex] = applyTaskEdit(out[c.lineIndex], { done: true, doneDate: today });
    }
  }
  return out;
}
