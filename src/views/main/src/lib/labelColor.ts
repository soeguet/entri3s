/**
 * Wählt eine lesbare Textfarbe (schwarz/weiß) für eine farbige Label-Badge.
 *
 * GitLab-Labels liefern eine beliebige Hintergrundfarbe (Hex). Feste weiße
 * Schrift wird auf hellen Farben unleserlich — daher die Helligkeit (YIQ)
 * bestimmen und kontrastabhängig schwarz oder weiß wählen.
 */
export function labelTextColor(bgHex: string): "#000000" | "#ffffff" {
  const hex = bgHex.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (full.length !== 6) return "#ffffff";
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return "#ffffff";
  // YIQ-Helligkeit: über ~150 gilt der Hintergrund als hell → schwarze Schrift.
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#000000" : "#ffffff";
}
