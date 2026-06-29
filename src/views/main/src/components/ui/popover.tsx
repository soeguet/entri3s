import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "./useFocusTrap";

interface PopoverProps {
  open: boolean;
  anchor: HTMLElement | null;
  anchorRect?: DOMRect | null;
  onClose: () => void;
  children: ReactNode;
}

/** Positioniertes Popover, verankert an einem HTMLElement. Portal + Focus-Trap. */
export function Popover(props: PopoverProps) {
  const trapRef = useFocusTrap(props.open);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  // "ready" verhindert ein sichtbares Aufblitzen oben-links: Solange die
  // Position noch nicht aus dem Anker berechnet wurde, bleibt das Popover
  // unsichtbar. useLayoutEffect berechnet die Position synchron VOR dem Paint
  // (und läuft auch in jsdom), daher sind die Children stets im DOM, nur eben
  // bis zur Berechnung visuell versteckt — Tests sehen die Children trotzdem.
  const [ready, setReady] = useState(false);

  // Position berechnen und bei Scroll/Resize aktualisieren.
  useLayoutEffect(() => {
    if (!props.open || !props.anchor) {
      setReady(false);
      return;
    }
    const gap = 4;
    function update() {
      const rect =
        props.anchorRect ??
        (props.anchor && props.anchor.isConnected ? props.anchor.getBoundingClientRect() : null);
      if (!rect) return;
      // Echte Masse messen statt schaetzen. In jsdom ist offsetWidth/Height 0 →
      // Fallback auf die bisherigen Schaetzwerte, damit Positionierung & Tests laufen.
      const popW = trapRef.current?.offsetWidth || 320; // w-80 = 320px
      const popH = trapRef.current?.offsetHeight || 300;

      // Bevorzugt unter dem Anker; nur hochklappen, wenn unten kein Platz ist.
      let top = rect.bottom + gap;
      if (top + popH > window.innerHeight) top = rect.top - popH - gap;

      let left = rect.left;
      // Auf beiden Achsen in den Viewport clampen; untere Grenze nie unter 8,
      // damit top/left bei zu grossem Popover nicht negativ werden.
      const maxTop = Math.max(8, window.innerHeight - popH - 8);
      const maxLeft = Math.max(8, window.innerWidth - popW - 8);
      if (top > maxTop) top = maxTop;
      if (top < 8) top = 8;
      if (left > maxLeft) left = maxLeft;
      if (left < 8) left = 8;

      setPos({ top, left });
      setReady(true);
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [props.open, props.anchor, props.anchorRect, trapRef]);

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
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        // Bis die Position aus dem Anker berechnet ist, verstecken — vermeidet
        // das Aufblitzen oben-links bei {0,0}. Children bleiben im DOM.
        visibility: ready ? "visible" : "hidden",
      }}
      className="z-50 w-80 rounded-lg border bg-card p-4 shadow-lg"
    >
      {props.children}
    </div>,
    document.body,
  );
}
