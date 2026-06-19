/**
 * Bereitet von GitLab geliefertes HTML für die Anzeige im Frontend auf.
 *
 * GitLab rendert Emojis als Custom-Element `<gl-emoji ...>😄</gl-emoji>`. Diese
 * Web-Component ist im Frontend NICHT registriert, ein unbekanntes Custom-Element
 * rendert seinen Inhalt zwar prinzipiell, aber GitLab versteckt den Unicode-
 * Fallback teils per CSS/data-Attributen — verlässlich sichtbar wird das Emoji
 * erst, wenn wir das Element durch seinen inneren Unicode-Inhalt ersetzen.
 *
 * Bewusst regex-basiert und KISS gehalten: keine DOM-Parser-Abhängigkeit, und
 * die Util ist absichtlich allgemein (nicht ticket-spezifisch), damit auch der
 * Kommentar-Render sie nutzen kann.
 */
export function renderGitlabHtml(html: string): string {
  // Ersetzt <gl-emoji ...>X</gl-emoji> durch den inneren Inhalt X (Unicode-Fallback).
  return html.replace(/<gl-emoji\b[^>]*>([\s\S]*?)<\/gl-emoji>/gi, "$1");
}
