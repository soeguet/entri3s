import { Updater } from "electrobun/bun";

const DEV_SERVER_URL = "http://localhost:5173";
const BUNDLED_URL = "views://main/index.html";

/** Im Dev-Channel die Vite-HMR-Instanz nutzen, sonst das gebündelte View laden. */
export async function resolveViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      return DEV_SERVER_URL;
    } catch {
      // Dev-Server nicht erreichbar — Bundle laden.
    }
  }
  return BUNDLED_URL;
}
