/**
 * Löst eine GitLab-Upload-`src` (aus gerendertem Issue-/Kommentar-HTML, z. B.
 * `/uploads/abc/bild.png` oder `/-/project/1/uploads/abc/bild.png`) zu einer
 * absoluten, mit Token fetchbaren URL auf — oder liefert `null`, wenn das nicht
 * sicher erlaubt ist.
 *
 * SICHERHEIT (bewusste, nicht-normale Entscheidung): Der Proxy schickt den
 * PRIVATE-TOKEN als Header mit. Würde eine absolute `src` auf einen FREMDEN Host
 * zeigen (z. B. weil ein Kommentar ein externes <img src> enthält), würde der
 * Token an diesen Host geleakt. Darum gilt strikt Same-Origin: absolute URLs sind
 * nur erlaubt, wenn ihre Origin (protocol+host+port) EXAKT der konfigurierten
 * gitlabUrl-Origin entspricht. Alles andere → null (kein Fetch, kein Token).
 */
export function resolveUploadUrl(gitlabUrl: string, src: string): string | null {
  const trimmed = gitlabUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) return null;

  let base: URL;
  try {
    base = new URL(trimmed);
  } catch {
    return null;
  }

  let resolved: URL;
  try {
    // Relative `src` werden gegen die gitlab-Basis aufgelöst; absolute bleiben
    // wie sie sind (und werden danach gegen die Origin geprüft).
    resolved = new URL(src, base);
  } catch {
    return null;
  }

  if (resolved.origin !== base.origin) return null;
  return resolved.toString();
}
