import type { BrowserWindow } from "electrobun/bun";
import type { AppEmitter } from "./emitter";
import type { AppRpc } from "./handlers";

/**
 * Konkrete AppEmitter-Implementierung, die Events über die RPC-Bridge an die
 * Webview sendet. Optional chaining schützt vor noch nicht bereiter Webview.
 */
export function createWindowEmitter(getWin: () => BrowserWindow<AppRpc> | undefined): AppEmitter {
  const send = () => getWin()?.webview?.rpc?.send;
  return {
    bookingCompleted: () => send()?.bookingCompleted({}),
    bookingFailed: (error) => send()?.bookingFailed({ error }),
    syncCompleted: () => send()?.syncCompleted({}),
    syncFailed: (error) => send()?.syncFailed({ error }),
    orphanDetected: (count) => send()?.orphanDetected({ count }),
  };
}
