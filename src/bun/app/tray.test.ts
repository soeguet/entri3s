import { test, expect } from "bun:test";
import type { MenuItemConfig } from "electrobun/bun";
import type { Entry } from "../../shared/types";
import { formatElapsed } from "../../shared/time";
import { createTrayController, trayView, type TrayHandle } from "./tray";

const IDLE = "views://main/tray-icons/timer-idle.png";
const RUNNING = "views://main/tray-icons/timer-running.png";

function makeEntry(date: string): Entry {
  return {
    id: 1,
    notes: null,
    durationMinutes: 0,
    date,
    status: "running",
    tagIds: [],
    ticketIds: [],
    createdAt: date,
    updatedAt: date,
  };
}

test("trayView: null entry → idle icon + idle title", () => {
  const view = trayView(null, Date.now());
  expect(view.image).toBe(IDLE);
  expect(view.title).toContain("kein Timer");
});

test("trayView: running entry → running icon + elapsed title", () => {
  const start = "2026-06-17T10:00:00.000Z";
  const now = Date.parse(start) + 65_000; // 1m 5s
  const view = trayView(makeEntry(start), now);
  expect(view.image).toBe(RUNNING);
  expect(view.title).toContain(formatElapsed(65_000));
  expect(view.title).toContain("00:01:05");
});

interface FakeTray extends TrayHandle {
  titles: string[];
  images: string[];
  menus: MenuItemConfig[][];
  fire: (event: unknown) => void;
  removed: boolean;
}

function makeFakeTray(): FakeTray {
  let handler: (event: unknown) => void = () => {};
  const fake: FakeTray = {
    titles: [],
    images: [],
    menus: [],
    removed: false,
    setTitle: (t) => fake.titles.push(t),
    setImage: (i) => fake.images.push(i),
    setMenu: (m) => fake.menus.push(m),
    on: (_name, h) => {
      handler = h;
    },
    remove: () => {
      fake.removed = true;
    },
    fire: (event) => handler(event),
  };
  return fake;
}

function stopItem(menu: MenuItemConfig[]): Extract<MenuItemConfig, { type: "normal" }> {
  const item = menu.find((m) => m.type === "normal" && m.action === "stop");
  return item as Extract<MenuItemConfig, { type: "normal" }>;
}

test("createTrayController: idle initial refresh disables stop", () => {
  const fake = makeFakeTray();
  const ctl = createTrayController({
    getRunning: () => null,
    stopRunning: () => {},
    onChanged: () => {},
    activateWindow: () => {},
    createTray: () => fake,
  });
  expect(fake.images[0]).toBe(IDLE);
  expect(fake.titles[0]).toContain("kein Timer");
  expect(stopItem(fake.menus[0]!).enabled).toBe(false);
  ctl.dispose();
  expect(fake.removed).toBe(true);
});

test("createTrayController: running refresh enables stop + running icon", () => {
  const fake = makeFakeTray();
  const ctl = createTrayController({
    getRunning: () => makeEntry("2026-06-17T10:00:00.000Z"),
    stopRunning: () => {},
    onChanged: () => {},
    activateWindow: () => {},
    createTray: () => fake,
  });
  expect(fake.images[0]).toBe(RUNNING);
  expect(stopItem(fake.menus[0]!).enabled).toBe(true);
  ctl.dispose();
});

test("createTrayController: stop click stops + notifies", () => {
  const fake = makeFakeTray();
  let stopped = 0;
  let changed = 0;
  const ctl = createTrayController({
    getRunning: () => makeEntry("2026-06-17T10:00:00.000Z"),
    stopRunning: () => {
      stopped++;
    },
    onChanged: () => {
      changed++;
    },
    activateWindow: () => {},
    createTray: () => fake,
  });
  fake.fire({ data: { action: "stop" } });
  expect(stopped).toBe(1);
  expect(changed).toBe(1);
  ctl.dispose();
});

test("createTrayController: open + bare icon click activate window", () => {
  const fake = makeFakeTray();
  let activated = 0;
  const ctl = createTrayController({
    getRunning: () => null,
    stopRunning: () => {},
    onChanged: () => {},
    activateWindow: () => {
      activated++;
    },
    createTray: () => fake,
  });
  fake.fire({ data: { action: "open" } });
  fake.fire({ data: { action: "" } });
  expect(activated).toBe(2);
  ctl.dispose();
});
