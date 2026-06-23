import { useEffect, useId, type ReactNode } from "react";
import { cn } from "../../lib/utils";
import { useFocusTrap } from "./useFocusTrap";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  // Optionaler Esc-Handler: erlaubt z.B. ein "einen Schritt zurück" in
  // Sub-Views, statt den ganzen Dialog zu schliessen. Fehlt er, schliesst Esc
  // wie gehabt (onClose).
  onEscape?: () => void;
  title?: string;
  size?: "md" | "lg" | "xl"; // md = Standard (max-w-lg)
  children: ReactNode;
}

const SIZE_CLASS: Record<NonNullable<DialogProps["size"]>, string> = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
};

/** Schlichter, kontrollierter Modal-Dialog (Overlay + Box). */
export function Dialog(props: DialogProps) {
  const onClose = props.onClose;
  const onEscape = props.onEscape;
  const titleId = useId();
  const trapRef = useFocusTrap(props.open);

  // Esc schliesst den Dialog – fokus-unabhängig (global), damit das Wegklicken
  // auch funktioniert, wenn der Fokus nicht in einem Eingabefeld liegt.
  // onEscape erlaubt ein abweichendes Verhalten (z.B. "zurück" in einer Sub-View).
  useEffect(() => {
    if (!props.open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") (onEscape ?? onClose)();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props.open, onClose, onEscape]);

  if (!props.open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={props.onClose}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={props.title ? titleId : undefined}
        className={cn(
          "max-h-[90vh] w-full overflow-y-auto rounded-lg bg-card p-6 shadow-xl",
          SIZE_CLASS[props.size ?? "md"],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {props.title ? (
          <h2 id={titleId} className="mb-4 text-lg font-semibold">
            {props.title}
          </h2>
        ) : null}
        {props.children}
      </div>
    </div>
  );
}
