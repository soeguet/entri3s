import { existsSync } from "node:fs";
import type { FSWatcher } from "chokidar";
import type { Repository } from "../repository";
import type { AppEmitter } from "../app/emitter";
import { isSelfWrite } from "./mutate";
import { hashContent, watch } from "./vault";

// Hält den chokidar-Watcher für den konfigurierten todoFolder am Leben und
// pollt (leichtgewichtig) auf Konfig-Wechsel, damit ein in den Settings neu
// gesetzter Ordner ohne Neustart beobachtet wird. Self-write-suppression
// HASH-basiert: ein Event, dessen aktueller Datei-Hash dem zuletzt selbst
// geschriebenen entspricht, wird verworfen.

export interface TodoWatcherHandle {
  close(): void;
}

export function startTodoWatcher(repo: Repository, emit: AppEmitter): TodoWatcherHandle {
  let current: string | null = null;
  let watcher: FSWatcher | undefined;

  async function onChange(path: string): Promise<void> {
    try {
      const content = await Bun.file(path).text();
      if (isSelfWrite(path, hashContent(content))) return;
    } catch {
      // Datei evtl. gelöscht/umbenannt — dann ist es kein self-write, Event durchlassen.
    }
    emit.todosChanged();
  }

  function sync(): void {
    const dir = repo.settings.getAll().todoFolder.trim();
    const target = dir && existsSync(dir) ? dir : null;
    if (target === current) return;
    current = target;
    watcher?.close();
    watcher = target ? watch(target, (p) => void onChange(p)) : undefined;
  }

  sync();
  const poll = setInterval(sync, 5_000);

  return {
    close() {
      clearInterval(poll);
      watcher?.close();
    },
  };
}
