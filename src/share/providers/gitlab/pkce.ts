/**
 * @file pkce.ts
 * @brief PKCE (RFC 7636) helpers: code verifier, S256 code challenge, random state.
 *
 * `crypto.subtle` exists only in secure contexts (https, localhost). The LAN deployment is plain
 * http (http://192.168.0.22/railway-drawer/), so SHA-256 falls back to the small implementation
 * in security/sha256.ts; `crypto.getRandomValues` works everywhere.
 */
import { sha256 } from '../../../security/sha256';

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const VERIFIER_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

/** Random string of RFC 7636 "unreserved" characters (43..128 long). */
export function randomVerifier(length = 64, random: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  if (length < 43 || length > 128) throw new Error('PKCE code verifier must be 43..128 characters');
  // 256 % 66 != 0: bytes >= 198 (3 * 66) are skipped so every character is equally likely
  const limit = 256 - (256 % VERIFIER_ALPHABET.length);
  let out = '';
  while (out.length < length) {
    for (const byte of random(new Uint8Array(length))) {
      if (byte < limit && out.length < length) out += VERIFIER_ALPHABET[byte % VERIFIER_ALPHABET.length];
    }
  }
  return out;
}

/** Random URL-safe token (state). */
export function randomToken(bytes = 24): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** S256 code challenge: base64url(SHA-256(ASCII(verifier))). */
export async function codeChallengeS256(verifier: string, subtle: SubtleCrypto | undefined = (globalThis as { crypto?: Crypto }).crypto?.subtle): Promise<string> {
  const bytes = new TextEncoder().encode(verifier);
  if (subtle) {
    try {
      return base64UrlEncode(new Uint8Array(await subtle.digest('SHA-256', bytes)));
    } catch {
      // fall through to the JS implementation
    }
  }
  return base64UrlEncode(sha256(bytes));
}
