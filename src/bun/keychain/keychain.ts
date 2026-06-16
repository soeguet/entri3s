import { getPassword, setPassword, deletePassword } from "keytar";

const SERVICE = "entries-app";
const ACCOUNT = "gitlab_token";

export async function setToken(token: string): Promise<void> {
  await setPassword(SERVICE, ACCOUNT, token);
}

/** Liest das Token; gibt bei nicht verfügbarem Keychain null zurück statt zu werfen. */
export async function getToken(): Promise<string | null> {
  try {
    return await getPassword(SERVICE, ACCOUNT);
  } catch (e) {
    console.error("keychain: getToken failed", e);
    return null;
  }
}

export async function deleteToken(): Promise<boolean> {
  return deletePassword(SERVICE, ACCOUNT);
}
