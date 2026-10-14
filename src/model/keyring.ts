// Per-provider keyring (~/.config/mochi/auth.json, mode 600): mochi owns one
// stored key PER PROVIDER (opencode auth.json parity), so switching providers
// never loses keys and any provider's key can be cleared — the old single
// active-slot model made logout/reset meaningless for non-active providers.
//
// Shape: { [providerId]: { type: 'api-key' | 'oauth', key, updatedAtMs } }.
// The path derives from the config dir, so the MOCHI_CONFIG_PATH override the
// test suite uses keeps this hermetic too. Reads never throw (corrupt file =
// empty ring); writes set 600 explicitly (config.json inherits umask, but a
// key file must not).

import { readFileSync, writeFileSync, mkdirSync, chmodSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { configFilePath } from './providers.js';

export type KeyringType = 'api-key' | 'oauth';

export interface KeyringEntry {
  type: KeyringType;
  key: string;
  updatedAtMs: number;
}

export type Keyring = Record<string, KeyringEntry>;

/** Path of the keyring file (sibling of the config file). */
export function keyringPath(): string {
  return resolve(dirname(configFilePath()), 'auth.json');
}

function isEntry(v: unknown): v is KeyringEntry {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  return (e.type === 'api-key' || e.type === 'oauth')
    && typeof e.key === 'string'
    && e.key.length > 0;
}

/** Load the ring; corrupt/missing/unreadable files yield {} (never throws). */
export function loadKeyring(): Keyring {
  try {
    const raw = readFileSync(keyringPath(), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const ring: Keyring = {};
    for (const [id, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (isEntry(entry)) ring[id] = { type: entry.type, key: entry.key, updatedAtMs: typeof entry.updatedAtMs === 'number' ? entry.updatedAtMs : 0 };
    }
    return ring;
  } catch {
    return {};
  }
}

/** Persist the ring with owner-only permissions (never throws callers off). */
export function saveKeyring(ring: Keyring): void {
  const path = keyringPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(ring, null, 2));
  try {
    chmodSync(path, 0o600);
  } catch { /* best-effort (win32 ACLs differ) */ }
}

/** Stored key for one provider (undefined when absent). Pure read. */
export function getKeyringKey(ring: Keyring, providerId: string): string | undefined {
  return ring[providerId]?.key;
}

/** Store (or overwrite) one provider's key. */
export function setKeyringKey(providerId: string, key: string, type: KeyringType = 'api-key'): Keyring {
  const ring = loadKeyring();
  ring[providerId] = { type, key, updatedAtMs: Date.now() };
  saveKeyring(ring);
  return ring;
}

/** Delete one provider's key. True when an entry existed. */
export function deleteKeyringKey(providerId: string): boolean {
  const ring = loadKeyring();
  if (!(providerId in ring)) return false;
  delete ring[providerId];
  saveKeyring(ring);
  return true;
}

/** Resolve the stored key for a provider: keyring first, then the legacy
 *  single active-slot (config.model.apiKey) for the ACTIVE provider only.
 *  Legacy users lose nothing: their key keeps working until they re-login,
 *  which writes the keyring. Pure (caller supplies both sides). */
export function storedKeyForProvider(
  ring: Keyring,
  providerId: string,
  activeId: string,
  legacyActiveKey: string | undefined,
): string | undefined {
  return getKeyringKey(ring, providerId)
    ?? (providerId === activeId ? legacyActiveKey : undefined);
}

/** Current on-disk mode (for the 600 assertion in tests). Null when absent. */
export function keyringMode(): number | null {
  try {
    return statSync(keyringPath()).mode & 0o777;
  } catch {
    return null;
  }
}
