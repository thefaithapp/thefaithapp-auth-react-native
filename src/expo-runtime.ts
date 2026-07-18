import * as Application from 'expo-application'
import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import * as WebBrowser from 'expo-web-browser'

import type {
  AuthBrowser,
  CryptoProvider,
  FetchImplementation,
  SessionStore,
} from './contracts'
import { TheFaithAuthError } from './errors'
import {
  parseSession,
  serializeSession,
  type TheFaithAuthSession,
} from './models'

export const expoCryptoProvider: CryptoProvider = {
  async randomBytes(length) {
    return Crypto.getRandomBytesAsync(length)
  },
  async sha256Base64(value) {
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value, {
      encoding: Crypto.CryptoEncoding.BASE64,
    })
  },
  async sha256Hex(value) {
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value)
  },
}

export const expoAuthBrowser: AuthBrowser = {
  async authenticate(authorizationUrl, callbackUri) {
    let result: WebBrowser.WebBrowserAuthSessionResult
    try {
      result = await WebBrowser.openAuthSessionAsync(
        authorizationUrl,
        callbackUri,
      )
    } catch (cause) {
      throw new TheFaithAuthError(
        'network',
        'The hosted sign-in session could not be completed.',
        { cause },
      )
    }

    if (result.type === 'success') return result.url
    if (result.type === 'cancel' || result.type === 'dismiss') {
      throw new TheFaithAuthError(
        'cancelled',
        'Member sign-in was cancelled.',
      )
    }

    throw new TheFaithAuthError(
      'network',
      'The hosted sign-in session could not be completed.',
    )
  },
}

export class ExpoSecureSessionStore implements SessionStore {
  private readonly keyPromise: Promise<string>

  constructor(apiKey: string, crypto: CryptoProvider = expoCryptoProvider) {
    this.keyPromise = crypto
      .sha256Hex(apiKey)
      .then((digest) => `thefaithapp_auth.session.${digest.slice(0, 24)}`)
  }

  async read(): Promise<TheFaithAuthSession | null> {
    try {
      const value = await SecureStore.getItemAsync(await this.keyPromise)
      if (!value) return null
      return parseSession(JSON.parse(value))
    } catch (cause) {
      throw new TheFaithAuthError(
        'session_storage',
        'The saved member session could not be read.',
        { cause },
      )
    }
  }

  async write(session: TheFaithAuthSession): Promise<void> {
    try {
      await SecureStore.setItemAsync(
        await this.keyPromise,
        JSON.stringify(serializeSession(session)),
        { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY },
      )
    } catch (cause) {
      throw new TheFaithAuthError(
        'session_storage',
        'The member session could not be stored securely.',
        { cause },
      )
    }
  }

  async clear(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(await this.keyPromise)
    } catch (cause) {
      throw new TheFaithAuthError(
        'session_storage',
        'The saved member session could not be removed.',
        { cause },
      )
    }
  }
}

export const expoFetch: FetchImplementation = (input, init) =>
  globalThis.fetch(input, init)

export async function resolveExpoApplicationId(): Promise<string | null> {
  return Application.applicationId
}
