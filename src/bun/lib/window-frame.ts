export interface WindowFrame {
  width: number;
  height: number;
  x: number;
  y: number;
}

// Mindestgröße: unter diesen Werten ist das Fenster für ein Webview unbrauchbar
// (Electrobun scheitert an „invalid client area"). Ein degenerierter Frame darf
// nie wiederhergestellt werden — sonst hängt der kaputte Zustand bei jedem Start.
const MIN_WIDTH = 400;
const MIN_HEIGHT = 300;

/**
 * Parst gespeicherte Fenster-Bounds (JSON-String) und gibt bei fehlenden,
 * kaputten oder zu kleinen Werten den `fallback` zurück.
 */
export function parseWindowFrame(raw: string | null, fallback: WindowFrame): WindowFrame {
  if (!raw) return fallback;
  try {
    const p = JSON.parse(raw) as Partial<WindowFrame>;
    if (
      typeof p.width === "number" &&
      Number.isFinite(p.width) &&
      p.width >= MIN_WIDTH &&
      typeof p.height === "number" &&
      Number.isFinite(p.height) &&
      p.height >= MIN_HEIGHT &&
      typeof p.x === "number" &&
      Number.isFinite(p.x) &&
      typeof p.y === "number" &&
      Number.isFinite(p.y)
    ) {
      return { width: p.width, height: p.height, x: p.x, y: p.y };
    }
  } catch {}
  return fallback;
}
