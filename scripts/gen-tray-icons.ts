/**
 * Generiert die beiden 32x32 Tray-Icons als echte PNGs:
 *   timer-idle.png    – gedämpfter grauer Kreis (kein Timer)
 *   timer-running.png – grüner Kreis (Timer läuft)
 * auf transparentem Hintergrund. Minimaler eigener PNG-Encoder (IHDR/IDAT/IEND
 * mit korrektem CRC32), damit keine externe Bild-Library nötig ist.
 *
 * Ausführen: `bun run scripts/gen-tray-icons.ts`
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SIZE = 32;

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
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff]! ^ (crc >>> 8);
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

/** RGBA-Pixel eines gefüllten Kreises in den Roh-Scanlines erzeugen. */
function renderCircle(r: number, g: number, b: number): Uint8Array {
  const rows = SIZE * (1 + SIZE * 4); // pro Zeile 1 Filterbyte + RGBA
  const raw = Buffer.alloc(rows);
  const cx = (SIZE - 1) / 2;
  const cy = (SIZE - 1) / 2;
  const radius = SIZE / 2 - 1;
  let p = 0;
  for (let y = 0; y < SIZE; y++) {
    raw[p++] = 0; // Filter: None
    for (let x = 0; x < SIZE; x++) {
      const inside = (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
      raw[p++] = inside ? 255 : 0;
    }
  }
  return raw;
}

function encodePng(raw: Uint8Array): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
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

const outDir = join(import.meta.dir, "..", "src", "assets", "tray");
mkdirSync(outDir, { recursive: true });

writeFileSync(join(outDir, "timer-idle.png"), encodePng(renderCircle(120, 120, 120)));
writeFileSync(join(outDir, "timer-running.png"), encodePng(renderCircle(34, 197, 94)));

console.log(`Tray-Icons geschrieben nach ${outDir}`);
