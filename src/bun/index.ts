import { BrowserWindow } from "electrobun/bun";
import { openDatabase } from "./repository/db";
import { createRepository } from "./repository";
import { createGitLabClient } from "./gitlab/client";
import { createService } from "./service";
import { createRpc } from "./app/handlers";
import { createWindowEmitter } from "./app/window-emitter";
import { startWorker } from "./worker/worker";
import { startScheduler } from "./scheduler/scheduler";
import { getToken } from "./keychain/keychain";
import { resolveDataDir } from "./lib/paths";
import { resolveViewUrl } from "./lib/window-url";

const dataDir = resolveDataDir();
const db = openDatabase(dataDir);
const repo = createRepository(db);
repo.eventQueue.resetStuck();

const token = (await getToken()) ?? "";
const glClient = createGitLabClient(token, repo.settings.getAll());
const svc = createService(repo, glClient, db);

const win = new BrowserWindow({
  title: "entries",
  url: await resolveViewUrl(),
  frame: { width: 1280, height: 800, x: 200, y: 200 },
  rpc: createRpc(svc),
});

const emit = createWindowEmitter(win);
const workerHandle = startWorker(repo, glClient, emit);
const schedulerHandle = startScheduler(repo, svc, emit);

win.on("close", () => {
  clearInterval(workerHandle);
  clearInterval(schedulerHandle);
  db.close();
});

console.log(`entries started (data dir: ${dataDir})`);
