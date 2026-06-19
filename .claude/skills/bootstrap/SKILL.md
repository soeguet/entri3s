---
name: bootstrap
description: Macht eine frische Shell/einen frischen Container komplett projekt-fertig für entries — installiert mise + Toolchain (oxlint, oxfmt, node, bun, python) und die JS-Dependencies, aktiviert alles und verifiziert mit dem Quality-Gate. Verwende diesen Skill am Anfang einer neuen Session/Shell wenn `mise`, `oxlint`, `oxfmt` oder `node_modules` fehlen, oder wenn Befehle mit "command not found" / "Cannot find module" scheitern.
---

# bootstrap – frische Shell projekt-fertig machen

Der Web-/Remote-Container ist **ephemer**: `mise` und die mise-verwaltete Toolchain
(oxlint, oxfmt, node, …) sind nach einem Neustart weg, oft fehlt auch
`node_modules`. Symptome: `mise: command not found`, `oxlint: command not found`,
`Cannot find module 'electrobun/bun'` / `'date-fns-tz'`, oder rote Tests, die in
Wahrheit nur fehlende Dependencies sind.

Dieser Skill bringt alles in **einem idempotenten Schritt** zum Laufen.

## Ein-Schritt-Setup

Diesen Block ausführen (funktioniert aus einer nackten Shell, ohne dass mise schon
da ist; mehrfach ausführbar):

```bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# 1) mise (Toolchain-Manager) installieren, falls nicht vorhanden
if ! command -v mise >/dev/null 2>&1; then
  [ -x "$HOME/.local/bin/mise" ] || curl -fsSL https://mise.run | sh
fi
export PATH="$HOME/.local/bin:$PATH"

# 2) mise dauerhaft für künftige Shells aktivieren (.bashrc wird vom Profil geladen)
grep -q 'mise activate bash' ~/.bashrc 2>/dev/null || {
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
  echo 'eval "$(mise activate bash)"'         >> ~/.bashrc
}
eval "$(mise activate bash)"

# 3) Toolchain aus mise.toml installieren (oxlint, oxfmt, node, bun, python)
mise trust >/dev/null 2>&1 || true
mise install

# 4) JS-Dependencies
bun install

# 5) Readiness verifizieren: fmt → lint → typecheck → alle Tests
mise run check
```

Läuft `mise run check` grün durch (fmt+lint → typecheck → alle Tests),
ist die Shell vollständig projekt-fertig.

## Schneller, ohne Tests

Wenn nur die Tools gebraucht werden (z.B. nur formatieren/linten), Schritt 5
weglassen oder durch `mise run lint` ersetzen. Der volle `check` dauert ~25s
wegen der Testsuiten.

## Wann reicht ein Teil

- Nur `node_modules` fehlt (mise schon da): `bun install`.
- Nur Tools fehlen (deps schon da): Schritte 1–3.
- „Cannot find module" in `bun test`: fast immer fehlt `bun install` → Schritt 4.

## Dauerhaft ohne diesen Skill (Empfehlung)

Damit künftige Web-Sessions gar nicht erst manuell gebootstrappt werden müssen,
gehört derselbe Ablauf ins **Setup-Skript der Web-Umgebung**
(code.claude.com → Environment → Setup-Skript):

```bash
curl -fsSL https://mise.run | sh
export PATH="$HOME/.local/bin:$PATH"
mise trust && mise install
bun install
```

Doku: https://code.claude.com/docs/en/claude-code-on-the-web

Ein committeter SessionStart-Hook, der bei jedem Start automatisch `curl | sh`
ausführt, wird bewusst **nicht** verwendet (Persistenz-/Sicherheits-Tradeoff);
dieser Skill ist die explizit aufgerufene Alternative.

## Verweise

- `mise`-Skill: Task-Runner-Konventionen (`mise run <task>`).
- Setup-Hinweis: **vor Tests immer `bun install`** — sonst Phantom-Fails („Cannot find module").
