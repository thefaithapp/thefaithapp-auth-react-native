import type { TheFaithAuthSession } from './models'

export interface CryptoProvider {
  randomBytes(length: number): Promise<Uint8Array>
  sha256Base64(value: string): Promise<string>
  sha256Hex(value: string): Promise<string>
}

export interface AuthBrowser {
  authenticate(authorizationUrl: string, callbackUri: string): Promise<string>
}

export interface SessionStore {
  read(): Promise<TheFaithAuthSession | null>
  write(session: TheFaithAuthSession): Promise<void>
  clear(): Promise<void>
}

export type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

export interface AuthClientDependencies {
  browser: AuthBrowser
  crypto: CryptoProvider
  fetch: FetchImplementation
  resolveApplicationId(): Promise<string | null>
  sessionStore: SessionStore
  redirectUri?: string
}
