import { errorMessage } from "../lib/errors";

/** Einheitliche, dezente Fehleranzeige für fehlgeschlagene Queries/Mutationen. */
export function ErrorNote(props: { error: unknown; className?: string }) {
  return (
    <p className={"text-sm text-red-600 " + (props.className ?? "")}>{errorMessage(props.error)}</p>
  );
}
