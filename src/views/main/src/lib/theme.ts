import { useSyncExternalStore } from "react";

// Theme-Steuerung für das Frontend: Hell/Dunkel/System plus wählbare Akzentfarbe.
// Reine UI-Präferenz → in localStorage (kein RPC-Roundtrip, kein FOUC beim Start).
// Die Anwendung auf das DOM (`.dark`-Klasse + `data-accent`) passiert hier; das
// Inline-Script in index.html setzt denselben Zustand bereits vor dem ersten Paint.

export type ThemeMode = "system" | "light" | "dark";
export type AccentName = "slate" | "blue" | "indigo" | "violet" | "teal" | "emerald" | "rose";

// `swatch` ist nur die Vorschau-Farbe in den Settings (Mittelton, kein AAA-Anspruch).
// Die echten, kontrastgeprüften Werte liegen als CSS-Variablen in index.css.
export const ACCENTS: { name: AccentName; label: string; swatch: string }[] = [
  { name: "slate", label: "Neutral", swatch: "#334155" },
  { name: "blue", label: "Blau", swatch: "#2563eb" },
  { name: "indigo", label: "Indigo", swatch: "#4f46e5" },
  { name: "violet", label: "Violett", swatch: "#7c3aed" },
  { name: "teal", label: "Türkis", swatch: "#0d9488" },
  { name: "emerald", label: "Grün", swatch: "#059669" },
  { name: "rose", label: "Rosé", swatch: "#e11d48" },
];

const MODE_KEY = "entries.theme.mode";
const ACCENT_KEY = "entries.theme.accent";
const DEFAULT_MODE: ThemeMode = "system";
const DEFAULT_ACCENT: AccentName = "slate";

interface ThemeState {
  mode: ThemeMode;
  accent: AccentName;
}

function readStored(): ThemeState {
  try {
    const mode = localStorage.getItem(MODE_KEY);
    const accent = localStorage.getItem(ACCENT_KEY);
    return {
      mode: isMode(mode) ? mode : DEFAULT_MODE,
      accent: isAccent(accent) ? accent : DEFAULT_ACCENT,
    };
  } catch {
    return { mode: DEFAULT_MODE, accent: DEFAULT_ACCENT };
  }
}

function isMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}
function isAccent(value: unknown): value is AccentName {
  return ACCENTS.some((a) => a.name === value);
}

/** System-Präferenz; im Test-/Non-Browser-Kontext defensiv auf hell. */
function prefersDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
}

/** Löst `system` zur tatsächlichen Erscheinung auf. */
export function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return prefersDark() ? "dark" : "light";
  return mode;
}

function applyToDom(state: ThemeState): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.classList.toggle("dark", resolveMode(state.mode) === "dark");
  el.setAttribute("data-accent", state.accent);
}

let state: ThemeState = readStored();
const listeners = new Set<() => void>();

function emit(): void {
  for (const cb of listeners) cb();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): ThemeState {
  return state;
}

export function setMode(mode: ThemeMode): void {
  state = { ...state, mode };
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // localStorage nicht verfügbar (z.B. Tests) – Zustand bleibt In-Memory.
  }
  applyToDom(state);
  emit();
}

export function setAccent(accent: AccentName): void {
  state = { ...state, accent };
  try {
    localStorage.setItem(ACCENT_KEY, accent);
  } catch {
    // s.o.
  }
  applyToDom(state);
  emit();
}

/** Einmalig beim App-Start aufrufen: DOM angleichen + Systemwechsel verfolgen. */
export function initTheme(): void {
  applyToDom(state);
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (state.mode === "system") {
        applyToDom(state);
        emit();
      }
    });
  }
}

/** React-Hook (gleiche Store-Konvention wie der Toaster). */
export function useTheme() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { mode: snapshot.mode, accent: snapshot.accent, setMode, setAccent };
}
