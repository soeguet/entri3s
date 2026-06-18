import { Tray, type MenuItemConfig } from "electrobun/bun";
import type { Entry } from "../../shared/types";
import { formatElapsed } from "../../shared/time";
import { createLogger } from "../lib/logger";

const log = createLogger("tray");

const EXT = process.platform === "win32" ? "ico" : "png";
const ICON_RUNNING = `views://main/tray-icons/timer-running.${EXT}`;
const ICON_IDLE = `views://main/tray-icons/timer-idle.${EXT}`;

/**
 * Berechnet rein funktional den sichtbaren Tray-Zustand aus dem laufenden Entry.
 * Der `title` dient unter Windows zugleich als Hover-Tooltip. Ausgelagert, damit
 * die Logik ohne FFI/Tray testbar bleibt.
 */
export function trayView(entry: Entry | null, now: number): { image: string; title: string } {
  if (entry === null) {
    return { image: ICON_IDLE, title: "entries - kein Timer" };
  }
  const elapsed = formatElapsed(now - Date.parse(entry.date));
  return { image: ICON_RUNNING, title: `entries - ${elapsed}` };
}

/** Minimales Tray-Interface, damit Tests einen Fake ohne FFI injizieren können. */
export interface TrayHandle {
  setTitle(title: string): void;
  setImage(imgPath: string): void;
  setMenu(menu: MenuItemConfig[]): void;
  on(name: "tray-clicked", handler: (event: unknown) => void): void;
  remove(): void;
}

export interface TrayDeps {
  getRunning: () => Entry | null;
  stopRunning: () => void;
  onChanged: () => void;
  activateWindow: () => void;
  createTray?: () => TrayHandle;
}

export interface TrayController {
  refresh: () => void;
  dispose: () => void;
}

/** Liest die Menü-Action aus einem unbekannten tray-clicked Event sicher heraus. */
function readAction(event: unknown): string {
  if (typeof event !== "object" || event === null) return "";
  const data = (event as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return "";
  const action = (data as { action?: unknown }).action;
  return typeof action === "string" ? action : "";
}

/**
 * Tray-Controller: zeigt den Timer-Status im Windows-System-Tray. Pollt alle 5s
 * den laufenden Entry (Zustand liegt in SQLite, ein paar Sekunden Lag sind ok)
 * und aktualisiert Icon, Titel und Kontextmenü. Per Dependency-Injection wie der
 * AppEmitter aufgebaut, damit er ohne Fenster/FFI testbar ist.
 */
export function createTrayController(deps: TrayDeps): TrayController {
  const tray: TrayHandle = deps.createTray
    ? deps.createTray()
    : new Tray({ image: ICON_IDLE, template: false, width: 32, height: 32 });

  let lastImage = "";

  function refresh(): void {
    const entry = deps.getRunning();
    const view = trayView(entry, Date.now());
    tray.setTitle(view.title);
    if (view.image !== lastImage) {
      tray.setImage(view.image);
      lastImage = view.image;
    }
    tray.setMenu([
      { type: "normal", label: "Fenster zeigen", action: "open" },
      { type: "divider" },
      { type: "normal", label: "Timer stoppen", action: "stop", enabled: entry !== null },
    ]);
  }

  tray.on("tray-clicked", (event: unknown) => {
    const action = readAction(event);
    if (action === "stop") {
      deps.stopRunning();
      deps.onChanged();
      refresh();
    } else {
      deps.activateWindow();
    }
  });

  refresh();
  const tick = setInterval(refresh, 5000);
  log.info("system tray initialisiert");

  function dispose(): void {
    clearInterval(tick);
    tray.remove();
  }

  return { refresh, dispose };
}
