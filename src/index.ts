import { TheFaithAppAuthClient } from './client'
import {
  ExpoSecureSessionStore,
  expoAuthBrowser,
  expoCryptoProvider,
  expoFetch,
  resolveExpoApplicationId,
} from './expo-runtime'
import type { TheFaithAuthSession } from './models'

export { TheFaithAuthError, type TheFaithAuthErrorCode } from './errors'
export type { TheFaithAuthSession, TheFaithMember } from './models'

export interface TheFaithAppAuthOptions {
  apiKey: string
}

/** Hosted member authentication for React Native and Expo applications. */
export class TheFaithAppAuth {
  private readonly client: TheFaithAppAuthClient

  constructor({ apiKey }: TheFaithAppAuthOptions) {
    this.client = new TheFaithAppAuthClient(apiKey, {
      browser: expoAuthBrowser,
      crypto: expoCryptoProvider,
      fetch: expoFetch,
      resolveApplicationId: resolveExpoApplicationId,
      sessionStore: new ExpoSecureSessionStore(apiKey),
    })
  }

  /** The callback URI to save in Developer Access. */
  get callbackUri(): Promise<string> {
    return this.client.callbackUri()
  }

  /** Opens hosted sign-in and securely persists the returned member session. */
  signIn(): Promise<TheFaithAuthSession> {
    return this.client.signIn()
  }

  /** Returns the securely saved session, if the member is signed in. */
  currentSession(): Promise<TheFaithAuthSession | null> {
    return this.client.currentSession()
  }

  /** Returns the current bearer token, if available. */
  accessToken(): Promise<string | null> {
    return this.client.accessToken()
  }

  /** Resolves a relative v1 API path. */
  apiUrl(path: string, query?: Record<string, string>): string {
    return this.client.apiUrl(path, query)
  }

  /** Sends a request with the client key and current member bearer token. */
  authorizedFetch(path: string, init?: RequestInit): Promise<Response> {
    return this.client.authorizedFetch(path, init)
  }

  /** Revokes the current bearer token and clears its secure local copy. */
  signOut(): Promise<void> {
    return this.client.signOut()
  }
}
