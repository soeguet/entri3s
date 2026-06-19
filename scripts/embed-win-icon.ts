/**
 * Post-Build-Schritt: bettet das App-Icon in die von electrobun erzeugten
 * Windows-.exe-Dateien ein. Notwendig, weil electrobuns intern gebündeltes
 * rcedit in 1.18.1 einen kaputten Resolve-Pfad hat und das Embedding still
 * überspringt. Wir rufen rcedit deshalb selbst auf.
 *
 * Ausführen (nach `electrobun build`): `bun run scripts/embed-win-icon.ts`
 */
import { resolve } from "node:path";
// rcedit (5.x, ESM) exportiert die Funktion als benannten Export `rcedit`,
// nicht als default; eigene Typdeklarationen bringt das Paket mit.
import { rcedit } from "rcedit";

if (process.platform !== "win32") {
  console.log("embed-win-icon: skip (Windows-only) – nichts zu tun auf", process.platform);
  process.exit(0);
}

const root = resolve(import.meta.dir, "..");
const icoPath = resolve(root, "src/assets/icon.ico");

const exePaths: string[] = [];
const winDirs = new Bun.Glob("build/*-win-x64").scanSync({ cwd: root, onlyFiles: false });
for (const dir of winDirs) {
  const exeGlob = new Bun.Glob(`${dir}/**/*.exe`).scanSync({ cwd: root });
  for (const exe of exeGlob) {
    exePaths.push(resolve(root, exe));
  }
}

if (exePaths.length === 0) {
  console.warn("embed-win-icon: WARN – keine build/*-win-x64/-Ordner mit .exe gefunden, nichts zu tun.");
  process.exit(0);
}

const failures: string[] = [];
for (const exe of exePaths) {
  try {
    await rcedit(exe, { icon: icoPath });
    console.log("embedded icon →", exe);
  } catch (err) {
    console.error("embed-win-icon: FEHLER beim Einbetten in", exe, "\n", err);
    failures.push(exe);
  }
}

if (failures.length > 0) {
  console.error(`embed-win-icon: ${failures.length} Datei(en) fehlgeschlagen:`, failures.join(", "));
  process.exit(1);
}

console.log(`embed-win-icon: fertig, ${exePaths.length} .exe verarbeitet.`);
