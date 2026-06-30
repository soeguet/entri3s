// Workaround (Doku-Policy: nicht-normale Stelle dokumentieren).
//
// Root Cause: Electrobuns native RPC-Brücke nutzt auf dem Bun→Webview
// Execute-Fallback-Pfad (evaluateJavascript) signed char. Jedes Byte b >= 0x80
// eines UTF-8-Multibyte-Zeichens wird vorzeichen-erweitert und kommt im
// Webview-JS-String als UTF-16-Code-Unit (0xFF00 | b) an. ASCII-Bytes (<0x80)
// bleiben unverändert. Der korrupte Bereich ist damit [0xFF80, 0xFFFF] und die
// Transformation verlustfrei umkehrbar (jede Unit & 0xFF ergibt das Originalbyte;
// der Byte-Run ist gültiges UTF-8 und wird dekodiert).
//
// Warum signatur-gegatet: Nur Multibyte-Strings sind betroffen. Der schnelle
// Scan lässt reine ASCII-Strings (der Normalfall) ohne Allokation unverändert
// durch.
//
// Warum forward-compatible: Repariert ein künftiger Electrobun-Fix den Pfad,
// liefert er echtes z.B. U+00FC ("ü"), das NICHT im Bereich [0xFF80, 0xFFFF]
// liegt und vom Scan ignoriert wird — diese Funktion bleibt dann ein No-Op.

const CORRUPT_LOW = 0xff80;
const decoder = new TextDecoder("utf-8");

function isCorrupt(unit: number): boolean {
  return unit >= CORRUPT_LOW && unit <= 0xffff;
}

function repairString(value: string): string {
  let hasCorrupt = false;
  for (let i = 0; i < value.length; i++) {
    if (isCorrupt(value.charCodeAt(i))) {
      hasCorrupt = true;
      break;
    }
  }
  if (!hasCorrupt) return value;

  let result = "";
  let i = 0;
  while (i < value.length) {
    if (isCorrupt(value.charCodeAt(i))) {
      const bytes: number[] = [];
      while (i < value.length && isCorrupt(value.charCodeAt(i))) {
        bytes.push(value.charCodeAt(i) & 0xff);
        i++;
      }
      result += decoder.decode(new Uint8Array(bytes));
    } else {
      result += value[i];
      i++;
    }
  }
  return result;
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function repairBridgeEncoding<T>(value: T): T {
  if (typeof value === "string") return repairString(value) as T;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = repairBridgeEncoding(value[i]);
    return value;
  }
  if (typeof value === "object" && value !== null && isPlainObject(value)) {
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) obj[key] = repairBridgeEncoding(obj[key]);
    return value;
  }
  return value;
}
