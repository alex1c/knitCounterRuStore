/**
 * UUID generation for entity primary keys.
 */

/**
 * Creates a new RFC 4122 UUID string suitable for local-first entity IDs.
 */
export function createId(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExpoCrypto = require('expo-crypto') as { randomUUID?: () => string };
    if (typeof ExpoCrypto.randomUUID === 'function') {
      const fromExpo = ExpoCrypto.randomUUID();
      if (typeof fromExpo === 'string' && fromExpo.length > 0) {
        return fromExpo;
      }
    }
  } catch {
    // Fall through to Node / Web Crypto API below.
  }

  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }

  throw new Error(
    'createId(): no UUID generator available (expo-crypto and crypto.randomUUID both missing)'
  );
}
