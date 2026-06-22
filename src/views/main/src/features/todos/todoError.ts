import { RpcError, errorMessage } from "../../lib/errors";

// Übersetzt Todo-Mutationsfehler in klare UX-Texte. TODO_CONFLICT bekommt die
// in der Spec vorgegebene Botschaft (Eingabe NICHT verworfen — das regeln die
// Komponenten selbst, indem sie ihren Draft-State behalten). INVALID_NAME wird
// am Eingabefeld gezeigt, TODO_NO_FOLDER triggert den Empty State (separat).
export function todoErrorMessage(err: unknown): string {
  if (err instanceof RpcError && err.code === "TODO_CONFLICT") {
    return "Aufgabe wurde extern geändert, nicht gespeichert";
  }
  return errorMessage(err);
}

export function isNoFolderError(err: unknown): boolean {
  return err instanceof RpcError && err.code === "TODO_NO_FOLDER";
}
