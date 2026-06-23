// Reine Logik für Drag&Drop-Umsortieren: aus der aktuellen ID-Reihenfolge einer
// Section ableiten, relativ zu welcher Zielaufgabe (targetId) und auf welcher
// Seite (before) der gezogene Task landen soll. Das Backend-RPC reorderTodoTask
// erwartet genau dieses (targetId, before)-Paar.
export function reorderIntent(
  orderedIds: string[],
  activeId: string,
  overId: string,
): { targetId: string; before: boolean } | null {
  if (activeId === overId) return null;
  const activeIndex = orderedIds.indexOf(activeId);
  const overIndex = orderedIds.indexOf(overId);
  if (activeIndex === -1 || overIndex === -1) return null;
  // Zieht man nach oben (activeIndex > overIndex), landet der Task VOR overId,
  // andernfalls dahinter.
  return { targetId: overId, before: activeIndex > overIndex };
}
