/**
 * Abstraktion über die Bun→Frontend Events. index.ts verdrahtet eine konkrete
 * Implementierung gegen `win.webview.rpc.send`; Tests nutzen einen Fake.
 */
export interface AppEmitter {
  bookingCompleted(): void;
  bookingFailed(error: string): void;
  syncCompleted(): void;
  syncFailed(error: string): void;
  orphanDetected(count: number): void;
}

export const noopEmitter: AppEmitter = {
  bookingCompleted() {},
  bookingFailed() {},
  syncCompleted() {},
  syncFailed() {},
  orphanDetected() {},
};
