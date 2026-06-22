import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "./useFocusTrap";

interface PopoverProps {
  open: boolean;
  anchor: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
}

/** Positioniertes Popover, verankert an einem HTMLElement. Portal + Focus-Trap. */
export function Popover(props: PopoverProps) {
  const trapRef = useFocusTrap(props.open);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Position berechnen und bei Scroll/Resize aktualisieren.
  useLayoutEffect(() => {
    if (!props.open || !props.anchor) return;
    function update() {
      const rect = props.anchor!.getBoundingClientRect();
      const popW = 320; // w-80 = 20rem = 320px
      const popH = 300; // geschaetzte Max-Hoehe fuer Flip

      let top = rect.bottom + 4;
      if (top + popH > window.innerHeight) {
        top = rect.top - popH - 4;
      }

      let left = rect.left;
      if (left + popW > window.innerWidth) left = window.innerWidth - popW - 8;
      if (left < 8) left = 8;

      setPos({ top, left });
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [props.open, props.anchor]);

  // Esc schliessen.
  useEffect(() => {
    if (!props.open) return;
    const onClose = props.onClose;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);

  // Klick ausserhalb schliessen.
  useEffect(() => {
    if (!props.open) return;
    const onClose = props.onClose;
    const anchor = props.anchor;
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (trapRef.current?.contains(target)) return;
      if (anchor?.contains(target)) return;
      onClose();
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [props.open, props.onClose, props.anchor, trapRef]);

  if (!props.open || !props.anchor) return null;

  return createPortal(
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", top: pos.top, left: pos.left }}
      className="z-50 w-80 rounded-lg border bg-card p-4 shadow-lg"
    >
      {props.children}
    </div>,
    document.body,
  );
}
