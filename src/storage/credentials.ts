import { KEYS, readKey, readSession, removeSession, writeKey, writeSession } from './base';

type CredentialMap = Record<string, { apiKey: string }>;

export async function loadCredentials(sessionOnly: boolean): Promise<CredentialMap> {
  if (sessionOnly) {
    const session = await readSession<CredentialMap>(KEYS.credentials);
    if (session) return session;
  }
  return readKey<CredentialMap>(KEYS.credentials, {});
}

export async function saveCredential(
  providerConfigId: string,
  apiKey: string,
  sessionOnly: boolean,
): Promise<void> {
  if (sessionOnly) {
    const current = (await readSession<CredentialMap>(KEYS.credentials)) ?? {};
    await writeSession(KEYS.credentials, { ...current, [providerConfigId]: { apiKey } });
    return;
  }
  const current = await readKey<CredentialMap>(KEYS.credentials, {});
  await writeKey(KEYS.credentials, { ...current, [providerConfigId]: { apiKey } });
}

export async function removeCredential(providerConfigId: string): Promise<void> {
  const persisted = await readKey<CredentialMap>(KEYS.credentials, {});
  if (persisted[providerConfigId]) {
    const next = { ...persisted };
    delete next[providerConfigId];
    await writeKey(KEYS.credentials, next);
  }
  const session = await readSession<CredentialMap>(KEYS.credentials);
  if (session?.[providerConfigId]) {
    const next = { ...session };
    delete next[providerConfigId];
    await writeSession(KEYS.credentials, next);
  }
}

export async function clearAllCredentials(): Promise<void> {
  await writeKey(KEYS.credentials, {});
  await removeSession(KEYS.credentials);
}
