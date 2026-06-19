import { mock } from "bun:test";

// keytar lädt beim Import ein natives .node-Modul (libsecret), das in der
// CI/Testumgebung fehlt und sonst schon beim Modul-Import von keychain.ts mit
// ERR_DLOPEN_FAILED abbricht. Über das Preload wird der Mock registriert, BEVOR
// irgendein Testmodul (und damit der statische keytar-Import) ausgewertet wird.
mock.module("keytar", () => ({
  setPassword: async () => {},
  getPassword: async () => null,
  deletePassword: async () => true,
}));
