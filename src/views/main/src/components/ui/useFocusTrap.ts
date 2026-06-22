import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Fängt den Tastaturfokus innerhalb eines Containers.
 * - Tab/Shift+Tab zirkulieren durch fokussierbare Elemente.
 * - Initial-Focus: setzt den Fokus auf das erste fokussierbare Element,
 *   SOFERN nicht bereits ein Kind fokussiert ist (respektiert autoFocus).
 * - Focus-Restore: gibt den Fokus beim Unmount an das vorher aktive Element zurück.
 */
export function useFocusTrap(active: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  // Focus-Restore-Referenz merken, bevor der Dialog rendert.
  useEffect(() => {
    if (!active) return;
    previousFocusRef.current = document.activeElement;
  }, [active]);

  // Initial-Focus setzen (nach Mount, respektiert autoFocus).
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    // Kurzes requestAnimationFrame, damit React/autoFocus erst greifen kann.
    const frameId = requestAnimationFrame(() => {
      if (!container.contains(document.activeElement)) {
        const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        first?.focus();
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, [active]);

  // Focus-Restore beim Deaktivieren/Unmount.
  useEffect(() => {
    if (!active) return;
    return () => {
      const prev = previousFocusRef.current;
      if (prev instanceof HTMLElement) prev.focus();
    };
  }, [active]);

  // Tab-Trap: Tab/Shift+Tab zirkulieren innerhalb des Containers.
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = Array.from(container!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    container.addEventListener("keydown", onKeyDown);
    return () => container.removeEventListener("keydown", onKeyDown);
  }, [active]);

  return containerRef;
}
