import { TheFaithAuthError } from './errors'

/** Build-time origin overrides for isolated SDK development builds. */
export const API_BASE_URL = parseEnvironmentOrigin(
  process.env.TFA_API_BASE_URL ?? 'https://api.thefaithapp.com',
)
export const HOSTED_AUTH_BASE_URL = parseEnvironmentOrigin(
  process.env.TFA_HOSTED_AUTH_BASE_URL ?? 'https://auth.thefaithapp.com',
)

export function parseEnvironmentOrigin(value: string): string {
  try {
    const url = new URL(value.trim())
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
      url.username || url.password || url.search || url.hash ||
      (url.pathname !== '' && url.pathname !== '/')
    ) {
      throw new Error('Invalid origin')
    }
    return url.origin
  } catch {
    throw new TheFaithAuthError(
      'configuration',
      'SDK origins must use HTTPS, or HTTP on loopback, without credentials, paths, queries, or fragments.',
    )
  }
}
