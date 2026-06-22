import { useEffect, useRef } from "react";

// ── Modul-Singleton statt Context-Provider ──────────────────────────────────
// Bewusst gewählt: ein einziger keydown-Listener auf window, verwaltet durch
// ref-gezählte Registrierung. Kein Provider nötig, kein Prop-Drilling, und der
// Blast-Radius bleibt auf dieses Modul beschränkt. Solange keine verschachtelten
// Hotkey-Scopes gebraucht werden, ist das die einfachste Lösung.

interface Binding {
  combo: ParsedCombo;
  handler: () => void;
  scope: "global" | "page";
  enabled: boolean;
}

interface ParsedCombo {
  key: string; // lowercase key
  mod: boolean; // ctrl oder meta
  shift: boolean;
}

const bindings: Binding[] = [];

function parseCombo(raw: string): ParsedCombo {
  const parts = raw.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  return {
    key,
    mod: parts.includes("mod"),
    shift: parts.includes("shift"),
  };
}

function isInputFocused(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function isModalOpen(): boolean {
  return document.querySelector('[aria-modal="true"]') !== null;
}

function hasModifier(combo: ParsedCombo): boolean {
  return combo.mod || combo.shift;
}

function matchesEvent(combo: ParsedCombo, e: KeyboardEvent): boolean {
  if (e.key.toLowerCase() !== combo.key) return false;
  if (combo.mod && !(e.ctrlKey || e.metaKey)) return false;
  if (!combo.mod && (e.ctrlKey || e.metaKey)) return false;
  if (combo.shift && !e.shiftKey) return false;
  return true;
}

function handleKeydown(e: KeyboardEvent): void {
  for (const binding of bindings) {
    if (!binding.enabled) continue;
    if (!matchesEvent(binding.combo, e)) continue;

    // Guard 1: Einzeltasten (kein Modifier) nicht aus Eingabefeldern feuern.
    if (!hasModifier(binding.combo) && isInputFocused(e.target)) continue;

    // Guard 2: page-Scope-Bindings nicht bei offenem Modal.
    if (binding.scope === "page" && isModalOpen()) continue;

    e.preventDefault();
    binding.handler();
    return;
  }
}

function attachListener(): void {
  window.addEventListener("keydown", handleKeydown);
}

function detachListener(): void {
  window.removeEventListener("keydown", handleKeydown);
}

interface HotkeyOptions {
  scope?: "global" | "page";
  enabled?: boolean;
}

export function useHotkey(combo: string, handler: () => void, options?: HotkeyOptions): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const scope = options?.scope ?? "page";
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    const binding: Binding = {
      combo: parseCombo(combo),
      handler: () => handlerRef.current(),
      scope,
      enabled,
    };

    // Ref-gezählt: beim ersten Binding den globalen Listener anbinden.
    if (bindings.length === 0) attachListener();
    bindings.push(binding);

    return () => {
      const idx = bindings.indexOf(binding);
      if (idx !== -1) bindings.splice(idx, 1);

      // Beim letzten Binding den Listener entfernen.
      if (bindings.length === 0) detachListener();
    };
  }, [combo, scope, enabled]);
}
