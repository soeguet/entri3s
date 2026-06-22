import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

/**
 * Rein präsentationaler Hover-Tooltip. Verankert via Portal (position: fixed),
 * damit Overflow der Tabelle ihn nicht abschneidet. Kein Focus-Trap, kein
 * Klick-/Escape-Handling — ein Tooltip ist nicht interaktiv.
 */
export function Tooltip(props: TooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Position am Anker berechnen; in jsdom liefert getBoundingClientRect 0 — das
  // ist unkritisch, da nur Sichtbarkeit zählt.
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const tipW = 320; // ~max-w-xs, für horizontales Clamping
    const tipH = 200; // geschätzte Max-Höhe für Flip nach oben

    let top = rect.bottom + 4;
    if (top + tipH > window.innerHeight) top = rect.top - tipH - 4;
    if (top < 8) top = 8;

    let left = rect.left;
    if (left + tipW > window.innerWidth) left = window.innerWidth - tipW - 8;
    if (left < 8) left = 8;

    setPos({ top, left });
  }, [open]);

  return (
    <span
      ref={anchorRef}
      className="inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {props.children}
      {open &&
        createPortal(
          <div
            role="tooltip"
            style={{ position: "fixed", top: pos.top, left: pos.left }}
            className="z-50 max-w-xs rounded border bg-card p-2 text-sm shadow-md"
          >
            {props.content}
          </div>,
          document.body,
        )}
    </span>
  );
}
