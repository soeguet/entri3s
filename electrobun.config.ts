import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "entries",
    identifier: "entries.electrobun.dev",
    version: "0.0.1",
  },
  build: {
    // Vite builds to dist/, we copy from there into the bundle as the "main" view
    copy: {
      "dist/index.html": "views/main/index.html",
      "dist/assets": "views/main/assets",
      "src/bun/repository/migrations": "bun/migrations",
      "src/assets/tray": "views/main/tray-icons",
    },
    // Ignore Vite output in watch mode — HMR handles view rebuilds separately
    watchIgnore: ["dist/**"],
    mac: {
      bundleCEF: false,
    },
    linux: {
      bundleCEF: false,
      icon: "src/assets/icon.png",
    },
    win: {
      bundleCEF: false,
      icon: "src/assets/icon.png",
    },
  },
} satisfies ElectrobunConfig;
