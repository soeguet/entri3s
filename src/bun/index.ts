import { BrowserWindow } from "electrobun/bun";
import { openDatabase } from "./repository/db";
import { createRepository } from "./repository";
import { createGitLabClient } from "./gitlab/client";
import { createService } from "./service";
import { createRpc } from "./app/handlers";
import { createWindowEmitter } from "./app/window-emitter";
import { createTrayController } from "./app/tray";
import { startWorker } from "./worker/worker";
import { startScheduler } from "./scheduler/scheduler";
import { getToken } from "./keychain/keychain";
import { startTodoWatcher } from "./todos/watcher";
import { resolveDataDir } from "./lib/paths";
import { resolveViewUrl } from "./lib/window-url";
import { parseWindowFrame } from "./lib/window-frame";

const dataDir = resolveDataDir();
const db = openDatabase(dataDir);
const repo = createRepository(db);
repo.eventQueue.resetStuck();

const token = (await getToken()) ?? "";
// Settings live lesen, damit eine geänderte gitlabUrl ohne Neustart wirkt.
const glClient = createGitLabClient(token, () => repo.settings.getAll());

// Emitter vor dem Fenster bauen (Services brauchen ihn), Fenster lazy nachreichen.
let win: BrowserWindow<ReturnType<typeof createRpc>> | undefined;
const emit = createWindowEmitter(() => win);
const svc = createService(repo, glClient, db, emit);

const DEFAULT_FRAME = { width: 1280, height: 800, x: 200, y: 200 };
const BOUNDS_KEY = "windowBounds";

function loadFrame(): { width: number; height: number; x: number; y: number } {
  return parseWindowFrame(repo.settings.get(BOUNDS_KEY), DEFAULT_FRAME);
}

win = new BrowserWindow({
  title: "entries",
  url: await resolveViewUrl(),
  frame: loadFrame(),
  rpc: createRpc(svc),
});
const workerHandle = startWorker(repo, glClient, emit);
const schedulerHandle = startScheduler(repo, svc, emit);
const todoWatcher = startTodoWatcher(repo, emit);

const trayCtl = createTrayController({
  getRunning: () => svc.entry.getRunning(),
  stopRunning: () => {
    const r = svc.entry.getRunning();
    if (r) svc.entry.stop(r.id);
  },
  onChanged: () => emit.runningEntryChanged(),
  activateWindow: () => win?.show(),
});

let boundsTimer: ReturnType<typeof setTimeout> | undefined;
function saveBoundsDebounced(): void {
  clearTimeout(boundsTimer);
  boundsTimer = setTimeout(() => {
    if (!win) return;
    const f = win.getFrame();
    repo.settings.set(BOUNDS_KEY, JSON.stringify(f));
  }, 500);
}
win.on("resize", saveBoundsDebounced);
win.on("move", saveBoundsDebounced);

win.on("close", () => {
  clearTimeout(boundsTimer);
  if (win) repo.settings.set(BOUNDS_KEY, JSON.stringify(win.getFrame()));
  clearInterval(workerHandle);
  clearInterval(schedulerHandle);
  todoWatcher.close();
  trayCtl.dispose();
  db.close();
});

console.log(`entries started (data dir: ${dataDir})`);
