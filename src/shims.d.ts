// Electrobuns Bun-Entrypoints importieren optionale native Deps (three), die
// ohne Typdeklarationen ausgeliefert werden. Wir nutzen sie nicht direkt —
// dieser Stub verhindert, dass `tsc --noEmit` in untypisierten Third-Party-Code
// absteigt.
declare module "three";
