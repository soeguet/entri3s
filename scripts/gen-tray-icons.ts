/**
 * Generiert die Icons der App als echte PNGs (kein externes Image-Lib):
 *   src/assets/tray/timer-idle.png    – grauer Stoppuhr-Glyph (kein Timer)  32x32
 *   src/assets/tray/timer-running.png – grüner Stoppuhr-Glyph (Timer läuft) 32x32
 *   src/assets/icon.png               – App-Identity-Icon (slate-900 Kachel) 256x256
 *
 * Qualität: gezeichnet wird in einen 4x supersampleten Puffer, danach per
 * 4x4-Box-Downsampling auf die Zielgröße gemittelt → anti-aliased Kanten.
 * Eigener PNG-Encoder (IHDR/IDAT/IEND mit korrektem CRC32).
 *
 * Ausführen: `bun run scripts/gen-tray-icons.ts`
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SS = 4; // Supersampling-Faktor

type RGBA = [number, number, number, number];

// Standard CRC32 (IEEE 802.3, reflektiert) mit vorberechneter Tabelle.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBytes, data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), out.length - 4);
  return out;
}

/** Einfache RGBA-Leinwand mit Alpha-Over-Komposit zum Zeichnen. */
class Canvas {
  readonly w: number;
  readonly h: number;
  readonly px: Float64Array; // r,g,b,a (a in 0..255)

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.px = new Float64Array(w * h * 4);
  }

  /** Pixel mit Alpha-Over (src über dst) mischen. */
  private blend(x: number, y: number, c: RGBA): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const sa = c[3] / 255;
    const da = this.px[i + 3]! / 255;
    const oa = sa + da * (1 - sa);
    if (oa <= 0) return;
    for (let k = 0; k < 3; k++) {
      const s = c[k]!;
      const d = this.px[i + k]!;
      this.px[i + k] = (s * sa + d * da * (1 - sa)) / oa;
    }
    this.px[i + 3] = oa * 255;
  }

  fillCircle(cx: number, cy: number, r: number, rgba: RGBA): void {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) this.blend(x, y, rgba);
      }
    }
  }

  /** Ring (gefüllte Kreisscheibe minus inneres Loch). */
  strokeRing(cx: number, cy: number, rOuter: number, rInner: number, rgba: RGBA): void {
    const ro2 = rOuter * rOuter;
    const ri2 = rInner * rInner;
    for (let y = Math.floor(cy - rOuter); y <= Math.ceil(cy + rOuter); y++) {
      for (let x = Math.floor(cx - rOuter); x <= Math.ceil(cx + rOuter); x++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 <= ro2 && d2 >= ri2) this.blend(x, y, rgba);
      }
    }
  }

  fillRect(x0: number, y0: number, x1: number, y1: number, rgba: RGBA): void {
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) this.blend(x, y, rgba);
    }
  }

  /** Abgerundetes Rechteck als gefüllte Fläche (Kachel-Hintergrund). */
  fillRoundRect(x0: number, y0: number, x1: number, y1: number, radius: number, rgba: RGBA): void {
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        const dx = Math.max(x0 + radius - x, 0, x - (x1 - radius));
        const dy = Math.max(y0 + radius - y, 0, y - (y1 - radius));
        if (dx * dx + dy * dy <= radius * radius) this.blend(x, y, rgba);
      }
    }
  }

  /** Zeiger vom Zentrum aus: dicke Linie unter `angleRad` (0 = nach oben). */
  drawHand(
    cx: number,
    cy: number,
    angleRad: number,
    len: number,
    thickness: number,
    rgba: RGBA,
  ): void {
    const ex = cx + Math.sin(angleRad) * len;
    const ey = cy - Math.cos(angleRad) * len;
    const steps = Math.ceil(len * 2);
    const r = thickness / 2;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      this.fillCircle(cx + (ex - cx) * t, cy + (ey - cy) * t, r, rgba);
    }
  }
}

/** 4x4-Box-Downsampling der supersampleten Leinwand auf die Zielgröße. */
function downsample(src: Canvas, size: number): Uint8Array {
  // raw scanlines: pro Zeile 1 Filterbyte + RGBA
  const raw = Buffer.alloc(size * (1 + size * 4));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // Filter: None
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * src.w + (x * SS + sx)) * 4;
          r += src.px[i]!;
          g += src.px[i + 1]!;
          b += src.px[i + 2]!;
          a += src.px[i + 3]!;
        }
      }
      const n = SS * SS;
      raw[p++] = Math.round(r / n);
      raw[p++] = Math.round(g / n);
      raw[p++] = Math.round(b / n);
      raw[p++] = Math.round(a / n);
    }
  }
  return raw;
}

function encodePng(raw: Uint8Array, size: number): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

const WHITE: RGBA = [255, 255, 255, 255];

/**
 * Zeichnet den Stoppuhr-Glyph mittig in `c`. `scale` ist die nutzbare
 * Glyph-Größe (Durchmesser-Bezug) in Leinwand-Pixeln, `cx/cy` das Zentrum.
 */
function drawStopwatch(
  c: Canvas,
  cx: number,
  cy: number,
  scale: number,
  body: RGBA,
  ring: RGBA,
  button: RGBA,
): void {
  const r = scale / 2;
  // Körper leicht nach unten versetzt, damit oben Platz für den Knopf bleibt.
  const bodyCy = cy + scale * 0.06;
  // Ring zur Definition (etwas dunkler als der Körper).
  c.strokeRing(cx, bodyCy, r, r * 0.82, ring);
  // Uhr-Gesicht (Körper).
  c.fillCircle(cx, bodyCy, r * 0.82, body);
  // Oberer Knopf: kleiner abgerundeter Stub mittig über dem Körper.
  const bw = scale * 0.14;
  const btop = bodyCy - r - scale * 0.1;
  const bbot = bodyCy - r + scale * 0.06;
  c.fillRoundRect(cx - bw, btop, cx + bw, bbot, bw * 0.8, button);
  // Zwei Zeiger aus dem Zentrum, weiß.
  c.drawHand(cx, bodyCy, 0, r * 0.62, scale * 0.07, WHITE); // 12 Uhr, länger
  c.drawHand(cx, bodyCy, Math.PI / 3, r * 0.42, scale * 0.07, WHITE); // ~2 Uhr, kürzer
  // Kleiner Mittelpunkt für sauberen Zeiger-Treffpunkt.
  c.fillCircle(cx, bodyCy, scale * 0.05, WHITE);
}

/** Erzeugt ein Tray-Icon (32x32) mit transparentem Hintergrund. */
function makeTrayIcon(size: number, body: RGBA, ring: RGBA, button: RGBA): Buffer {
  const c = new Canvas(size * SS, size * SS);
  const cx = (size * SS) / 2;
  const cy = (size * SS) / 2;
  drawStopwatch(c, cx, cy, size * SS * 0.82, body, ring, button);
  return encodePng(downsample(c, size), size);
}

/** Erzeugt das App-Icon (256x256): slate-900 Kachel + grüne Stoppuhr. */
function makeAppIcon(size: number): Buffer {
  const c = new Canvas(size * SS, size * SS);
  const dim = size * SS;
  const slate900: RGBA = [15, 23, 42, 255];
  const green: RGBA = [34, 197, 94, 255]; // Körper (#22c55e)
  const greenDark: RGBA = [21, 128, 61, 255]; // Ring + Knopf (#15803d)
  // Abgerundete Hintergrund-Kachel (Radius ~20% der Größe).
  const pad = dim * 0.04;
  c.fillRoundRect(pad, pad, dim - pad, dim - pad, dim * 0.2, slate900);
  // Grüner Stoppuhr-Glyph (wie "running"), weiße Zeiger, dunkelgrüner Ring/Knopf.
  // Glyph größer (0.68) damit er die Kachel klar ausfüllt.
  drawStopwatch(c, dim / 2, dim / 2, dim * 0.68, green, greenDark, greenDark);
  return encodePng(downsample(c, size), size);
}

const trayDir = join(import.meta.dir, "..", "src", "assets", "tray");
const assetsDir = join(import.meta.dir, "..", "src", "assets");
mkdirSync(trayDir, { recursive: true });
mkdirSync(assetsDir, { recursive: true });

// Tray: idle = slate-gray, running = green.
writeFileSync(
  join(trayDir, "timer-idle.png"),
  makeTrayIcon(32, [100, 116, 139, 255], [71, 85, 105, 255], [100, 116, 139, 255]),
);
writeFileSync(
  join(trayDir, "timer-running.png"),
  makeTrayIcon(32, [34, 197, 94, 255], [21, 128, 61, 255], [34, 197, 94, 255]),
);
// App-Icon.
writeFileSync(join(assetsDir, "icon.png"), makeAppIcon(256));

console.log(`Icons geschrieben: ${trayDir} und ${assetsDir}/icon.png`);
