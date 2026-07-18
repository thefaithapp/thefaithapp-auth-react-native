import type { CryptoProvider } from './contracts'

export interface PkceRequest {
  state: string
  verifier: string
  challenge: string
}

export async function createPkceRequest(
  crypto: CryptoProvider,
): Promise<PkceRequest> {
  const state = toBase64Url(await crypto.randomBytes(32))
  const verifier = toBase64Url(await crypto.randomBytes(64))
  const challenge = toBase64UrlString(await crypto.sha256Base64(verifier))

  return { state, verifier, challenge }
}

export function toBase64Url(bytes: Uint8Array): string {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let result = ''

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0
    const second = bytes[index + 1] ?? 0
    const third = bytes[index + 2] ?? 0
    const chunk = (first << 16) | (second << 8) | third

    result += alphabet[(chunk >> 18) & 63]
    result += alphabet[(chunk >> 12) & 63]
    result += index + 1 < bytes.length ? alphabet[(chunk >> 6) & 63] : '='
    result += index + 2 < bytes.length ? alphabet[chunk & 63] : '='
  }

  return toBase64UrlString(result)
}

function toBase64UrlString(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
