import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

import {
  TheFaithAppAuthClient,
  callbackUriForApplicationId,
} from '../src/client'
import type {
  AuthBrowser,
  CryptoProvider,
  FetchImplementation,
  SessionStore,
} from '../src/contracts'
import { TheFaithAuthError } from '../src/errors'
import type { TheFaithAuthSession } from '../src/models'

const apiKey = 'client-key'
const callbackUri = 'com.example.church.thefaithapp://auth/callback'

const sessionPayload = {
  access_token: 'member-token',
  token_type: 'Bearer',
  member: {
    id: 123,
    name: 'Jane Member',
    email: 'jane@example.com',
    client_id: 45,
    uuid: 'member-uuid',
  },
}

const testSession: TheFaithAuthSession = {
  accessToken: 'member-token',
  tokenType: 'Bearer',
  member: {
    id: 123,
    name: 'Jane Member',
    email: 'jane@example.com',
    clientId: 45,
    uuid: 'member-uuid',
  },
  receivedAt: new Date().toISOString(),
}

describe('TheFaithAppAuthClient', () => {
  it('derives the callback from the application ID', () => {
    expect(callbackUriForApplicationId('com.example.church')).toBe(callbackUri)
  })

  it('rejects application IDs that cannot be URL schemes', () => {
    expect(() => callbackUriForApplicationId('com.example.church_app')).toThrowError(
      expect.objectContaining<Partial<TheFaithAuthError>>({
        code: 'configuration',
      }),
    )
  })

  it('requires a client API key', () => {
    expect(() => createClient({ apiKey: '  ' })).toThrowError(
      expect.objectContaining<Partial<TheFaithAuthError>>({
        code: 'configuration',
      }),
    )
  })

  it('resolves API paths against the v1 API', () => {
    const client = createClient()
    expect(client.apiUrl('/v1/user')).toBe('https://api.thefaithapp.com/v1/user')
    expect(() => client.apiUrl('https://example.com/v1/user')).toThrowError(
      expect.objectContaining<Partial<TheFaithAuthError>>({
        code: 'configuration',
      }),
    )
  })

  it('uses S256 PKCE, validates state, and stores the session', async () => {
    const store = new MemorySessionStore()
    let startBody: Record<string, unknown> | undefined
    let tokenBody: Record<string, unknown> | undefined
    const fetchImplementation = vi.fn<FetchImplementation>(
      async (input, init) => {
        const path = new URL(input.toString()).pathname
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        if (path === '/v1/auth/start') {
          startBody = body
          return jsonResponse({
            auth_url: 'https://auth.thefaithapp.com/member/sign-in',
          })
        }
        if (path === '/v1/auth/token') {
          tokenBody = body
          return jsonResponse(sessionPayload)
        }
        throw new Error(`Unexpected request: ${path}`)
      },
    )
    const browser: AuthBrowser = {
      async authenticate() {
        return `${callbackUri}?code=one-time-code&state=${startBody?.state}`
      },
    }
    const client = createClient({ fetchImplementation, browser, store })

    const session = await client.signIn()

    expect(session.accessToken).toBe('member-token')
    expect(session.member.email).toBe('jane@example.com')
    expect(store.session).toEqual(session)
    expect(startBody?.code_challenge_method).toBe('S256')
    expect(startBody?.redirect_uri).toBe(callbackUri)
    expect(tokenBody?.code).toBe('one-time-code')
    expect(tokenBody?.redirect_uri).toBe(callbackUri)

    const verifier = String(tokenBody?.code_verifier)
    const expectedChallenge = createHash('sha256')
      .update(verifier)
      .digest('base64url')
    expect(startBody?.code_challenge).toBe(expectedChallenge)
  })

  it('rejects callbacks with the wrong state before exchanging the code', async () => {
    let tokenExchangeCalled = false
    const fetchImplementation = vi.fn<FetchImplementation>(
      async (input) => {
        if (new URL(input.toString()).pathname === '/v1/auth/start') {
          return jsonResponse({
            auth_url: 'https://auth.thefaithapp.com/member/sign-in',
          })
        }
        tokenExchangeCalled = true
        return jsonResponse(sessionPayload)
      },
    )
    const browser: AuthBrowser = {
      async authenticate() {
        return `${callbackUri}?code=one-time-code&state=forged-state`
      },
    }

    await expect(
      createClient({ fetchImplementation, browser }).signIn(),
    ).rejects.toMatchObject({ code: 'state_mismatch' })
    expect(tokenExchangeCalled).toBe(false)
  })

  it('adds both credentials to authenticated API requests', async () => {
    const store = new MemorySessionStore(testSession)
    const fetchImplementation = vi.fn<FetchImplementation>(
      async (input, init) => {
        expect(input.toString()).toBe('https://api.thefaithapp.com/v1/user')
        const headers = new Headers(init?.headers)
        expect(headers.get('X-API-Key')).toBe(apiKey)
        expect(headers.get('Authorization')).toBe('Bearer member-token')
        expect(headers.get('Accept')).toBe('application/json')
        return jsonResponse({ status: 'Success' })
      },
    )

    const response = await createClient({
      fetchImplementation,
      store,
    }).authorizedFetch('/v1/user')

    expect(response.status).toBe(200)
  })

  it('never accepts an external URL for authenticated requests', async () => {
    const fetchImplementation = vi.fn<FetchImplementation>()
    const client = createClient({
      fetchImplementation,
      store: new MemorySessionStore(testSession),
    })

    await expect(
      client.authorizedFetch('https://example.com/v1/user'),
    ).rejects.toMatchObject({ code: 'configuration' })
    expect(fetchImplementation).not.toHaveBeenCalled()
  })

  it('revokes the token before clearing local storage', async () => {
    const store = new MemorySessionStore(testSession)
    const fetchImplementation = vi.fn<FetchImplementation>(
      async (input, init) => {
        expect(new URL(input.toString()).pathname).toBe('/v1/auth/logout')
        const headers = new Headers(init?.headers)
        expect(headers.get('X-API-Key')).toBe(apiKey)
        expect(headers.get('Authorization')).toBe('Bearer member-token')
        return jsonResponse({ message: 'Logged out successfully.' })
      },
    )

    await createClient({ fetchImplementation, store }).signOut()

    expect(store.session).toBeNull()
  })

  it('rejects hosted auth URLs outside TheFaithApp', async () => {
    const browser = { authenticate: vi.fn() }
    const fetchImplementation = vi.fn<FetchImplementation>(async () =>
      jsonResponse({ auth_url: 'https://attacker.example/member/sign-in' }),
    )

    await expect(
      createClient({ browser, fetchImplementation }).signIn(),
    ).rejects.toMatchObject({ code: 'invalid_response' })
    expect(browser.authenticate).not.toHaveBeenCalled()
  })
})

function createClient({
  apiKey: clientApiKey = apiKey,
  browser = {
    async authenticate() {
      throw new Error('Browser was not configured for this test.')
    },
  },
  fetchImplementation = vi.fn<FetchImplementation>(),
  store = new MemorySessionStore(),
}: {
  apiKey?: string
  browser?: AuthBrowser
  fetchImplementation?: FetchImplementation
  store?: MemorySessionStore
} = {}) {
  return new TheFaithAppAuthClient(clientApiKey, {
    browser,
    crypto: testCrypto,
    fetch: fetchImplementation,
    resolveApplicationId: async () => 'com.example.church',
    sessionStore: store,
  })
}

const testCrypto: CryptoProvider = {
  async randomBytes(length) {
    return Uint8Array.from({ length }, (_, index) => (index + 17) % 256)
  },
  async sha256Base64(value) {
    return createHash('sha256').update(value).digest('base64')
  },
  async sha256Hex(value) {
    return createHash('sha256').update(value).digest('hex')
  },
}

class MemorySessionStore implements SessionStore {
  constructor(public session: TheFaithAuthSession | null = null) {}

  async read() {
    return this.session
  }

  async write(session: TheFaithAuthSession) {
    this.session = session
  }

  async clear() {
    this.session = null
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
