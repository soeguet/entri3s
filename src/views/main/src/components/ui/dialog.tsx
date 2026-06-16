import type { ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** Schlichter, kontrollierter Modal-Dialog (Overlay + Box). */
export function Dialog(props: DialogProps) {
  if (!props.open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={props.onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {props.title ? <h2 className="mb-4 text-lg font-semibold">{props.title}</h2> : null}
        {props.children}
      </div>
    </div>
  );
}
