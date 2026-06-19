import { useLayoutEffect, useRef } from "react";
import { getGitlabImage, getSettings } from "../../api";
import { unwrap } from "../../lib/errors";
import { renderGitlabHtml } from "../../lib/gitlabHtml";

interface GitlabContentProps {
  html: string;
}

/**
 * Rendert von GitLab geliefertes HTML (Beschreibung / Kommentar) und löst dabei
 * GitLab-Upload-Bilder auf.
 *
 * Warum DOM-Post-Processing statt sauberer React-Bäume? Das HTML kommt fertig
 * gerendert von GitLab (verschachtelt, mit Code-Blöcken, Tabellen, gl-emoji).
 * Wir setzen es per dangerouslySetInnerHTML und laufen danach per Ref über die
 * <img>-Elemente. String-Splitting auf dem HTML wäre fragil, weil es
 * verschachteltes Markup zerreißt — der Ref-Walk arbeitet auf dem geparsten DOM.
 *
 * Bewusst KEIN Sanitizing — lokale Single-User-App, HTML kommt vom eigenen
 * GitLab (gleiches Muster wie zuvor in CommentItem/TicketMeta).
 *
 * GitLab-/uploads/-Bilder brauchen ein Auth-Token, das die Webview nicht
 * mitschickt → sie würden als riesige kaputte Leerflächen rendern. Daher: jeden
 * Proxy-Kandidaten SOFORT durch einen kompakten Platzhalter ersetzen, dann via
 * getGitlabImage (Backend-Proxy) eine data-URL nachladen; bei Fehler kompakter
 * Link statt Leerblock.
 */
export function GitlabContent(props: GitlabContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    let cancelled = false;

    void (async () => {
      const gitlabUrl = await resolveGitlabUrl();
      if (cancelled) return;
      const imgs = root.querySelectorAll<HTMLImageElement>("img:not([data-gl-processed])");
      for (const img of imgs) {
        img.dataset.glProcessed = "1";
        processImage(img, gitlabUrl, () => cancelled);
      }
    })();

    return () => {
      cancelled = true;
    };
    // props.html neu rendern → DOM neu aufgebaut → erneut verarbeiten.
  }, [props.html]);

  return (
    <div
      ref={ref}
      className="gitlab-content"
      dangerouslySetInnerHTML={{ __html: renderGitlabHtml(props.html) }}
    />
  );
}

async function resolveGitlabUrl(): Promise<string> {
  try {
    return unwrap(await getSettings()).gitlabUrl;
  } catch {
    return "";
  }
}

/** Absolute Origin von gitlabUrl (oder "" falls ungültig). */
function gitlabOrigin(gitlabUrl: string): string {
  try {
    return new URL(gitlabUrl).origin;
  } catch {
    return "";
  }
}

/** Entscheidet, ob ein src über den Backend-Proxy geladen werden muss. */
function needsProxy(src: string, origin: string): boolean {
  if (!src || src.startsWith("data:")) return false;
  // Relativ (kein Schema, z.B. /uploads/...) → immer Kandidat.
  if (!/^[a-z]+:\/\//i.test(src)) return true;
  // Absolut mit gleicher Origin wie GitLab → Kandidat. Fremde public Bilder
  // laden ohnehin nativ und bleiben unangetastet.
  return origin !== "" && src.startsWith(origin);
}

/** Baut die absolute Original-URL (für den GitLab-Link) aus src + gitlabUrl. */
function absoluteUrl(src: string, gitlabUrl: string): string {
  try {
    return new URL(src, gitlabUrl || undefined).href;
  } catch {
    return src;
  }
}

function processImage(img: HTMLImageElement, gitlabUrl: string, isCancelled: () => boolean) {
  const origin = gitlabOrigin(gitlabUrl);
  const original = img.getAttribute("src") ?? "";
  if (!needsProxy(original, origin)) return;

  const targetUrl = absoluteUrl(original, gitlabUrl);
  const alt = img.getAttribute("alt") ?? "";
  const placeholder = makePlaceholder();
  img.replaceWith(placeholder);

  void (async () => {
    try {
      const dataUrl = unwrap(await getGitlabImage(original));
      if (isCancelled()) return;
      placeholder.replaceWith(makeImageLink(dataUrl, targetUrl, alt));
    } catch {
      if (isCancelled()) return;
      placeholder.replaceWith(makeFallbackLink(targetUrl));
    }
  })();
}

/** Kompakter Lade-Platzhalter (kein großer Leerblock vor dem Laden). */
function makePlaceholder(): HTMLElement {
  const chip = document.createElement("span");
  chip.className = "gitlab-img-placeholder";
  chip.textContent = "Bild lädt …";
  return chip;
}

/** Geladenes Bild, klickbar → Original in GitLab öffnen. */
function makeImageLink(dataUrl: string, targetUrl: string, alt: string): HTMLElement {
  const a = document.createElement("a");
  a.href = targetUrl;
  a.target = "_blank";
  a.rel = "noreferrer";
  const img = document.createElement("img");
  img.src = dataUrl;
  if (alt) img.alt = alt;
  img.dataset.glProcessed = "1";
  a.appendChild(img);
  return a;
}

/** Kompakter Fallback-Link statt Leerblock, wenn der Proxy scheitert. */
function makeFallbackLink(targetUrl: string): HTMLElement {
  const a = document.createElement("a");
  a.href = targetUrl;
  a.target = "_blank";
  a.rel = "noreferrer";
  a.className = "gitlab-img-fallback";
  a.textContent = "🖼️ Bild in GitLab öffnen";
  return a;
}
