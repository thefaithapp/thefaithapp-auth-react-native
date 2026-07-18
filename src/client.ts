import type {
  AuthClientDependencies,
  FetchImplementation,
} from './contracts'
import { API_BASE_URL, HOSTED_AUTH_BASE_URL } from './environment'
import { TheFaithAuthError } from './errors'
import {
  parseSession,
  sessionIsExpired,
  type TheFaithAuthSession,
} from './models'
import { createPkceRequest } from './pkce'

interface HostedAuthStart {
  authUrl: string
}

export class TheFaithAppAuthClient {
  readonly apiKey: string
  private signInInProgress = false

  constructor(
    apiKey: string,
    private readonly dependencies: AuthClientDependencies,
  ) {
    const normalized = apiKey.trim()
    if (!normalized) {
      throw new TheFaithAuthError(
        'configuration',
        'A TheFaithApp client API key is required.',
      )
    }
    this.apiKey = normalized
  }

  async callbackUri(): Promise<string> {
    if (this.dependencies.redirectUri) {
      return validateCallbackUri(this.dependencies.redirectUri)
    }

    const applicationId = await this.dependencies.resolveApplicationId()
    if (!applicationId) {
      throw new TheFaithAuthError(
        'configuration',
        'The application ID could not be read for the hosted auth callback.',
      )
    }

    return callbackUriForApplicationId(applicationId)
  }

  async signIn(): Promise<TheFaithAuthSession> {
    if (this.signInInProgress) {
      throw new TheFaithAuthError(
        'sign_in_in_progress',
        'A hosted sign-in session is already in progress.',
      )
    }

    this.signInInProgress = true
    try {
      const redirectUri = await this.callbackUri()
      const pkce = await createPkceRequest(this.dependencies.crypto)
      const start = await this.startHostedAuth(
        redirectUri,
        pkce.state,
        pkce.challenge,
      )
      const callbackUri = await this.dependencies.browser.authenticate(
        start.authUrl,
        redirectUri,
      )

      if (!callbacksMatch(callbackUri, redirectUri)) {
        throw new TheFaithAuthError(
          'callback_mismatch',
          'Hosted sign-in returned to an unexpected callback URI.',
        )
      }

      const callback = new URL(callbackUri)
      if (!constantTimeEquals(callback.searchParams.get('state') ?? '', pkce.state)) {
        throw new TheFaithAuthError(
          'state_mismatch',
          'Hosted sign-in returned an invalid state value.',
        )
      }

      const callbackError = callback.searchParams.get('error')
      if (callbackError) {
        throw new TheFaithAuthError(
          'server',
          callback.searchParams.get('error_description') ??
            'Hosted sign-in was not completed.',
        )
      }

      const code = callback.searchParams.get('code')
      if (!code) {
        throw new TheFaithAuthError(
          'missing_authorization_code',
          'Hosted sign-in did not return an authorization code.',
        )
      }

      const session = await this.exchangeCode(code, redirectUri, pkce.verifier)
      try {
        await this.dependencies.sessionStore.write(session)
      } catch (storageError) {
        try {
          await this.revoke(session)
        } catch {
          // Preserve the actionable secure-storage failure.
        }
        throw storageError
      }

      return session
    } finally {
      this.signInInProgress = false
    }
  }

  currentSession(): Promise<TheFaithAuthSession | null> {
    return this.dependencies.sessionStore.read()
  }

  async accessToken(): Promise<string | null> {
    const session = await this.currentSession()
    return !session || sessionIsExpired(session) ? null : session.accessToken
  }

  apiUrl(path: string, query?: Record<string, string>): string {
    if (/^[a-z][a-z0-9+.-]*:/i.test(path)) {
      throw new TheFaithAuthError(
        'configuration',
        'apiUrl expects a relative API path.',
      )
    }

    const normalized = path.startsWith('/') ? path : `/${path}`
    const url = new URL(normalized, API_BASE_URL)
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value)
    }
    return url.toString()
  }

  async authorizedFetch(
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const url = this.apiUrl(path)
    if (!sameOrigin(url, API_BASE_URL)) {
      throw new TheFaithAuthError(
        'unauthorized_host',
        'Authenticated requests can only be sent to TheFaithApp.',
      )
    }

    const session = await this.currentSession()
    if (!session || sessionIsExpired(session)) {
      throw new TheFaithAuthError(
        'not_authenticated',
        'Sign in before calling a protected TheFaithApp endpoint.',
      )
    }

    const headers = new Headers(init.headers)
    headers.set('X-API-Key', this.apiKey)
    headers.set('Authorization', `${session.tokenType} ${session.accessToken}`)
    if (!headers.has('Accept')) headers.set('Accept', 'application/json')

    return this.dependencies.fetch(url, { ...init, headers })
  }

  async signOut(): Promise<void> {
    const session = await this.currentSession()
    let remoteError: unknown

    if (session) {
      try {
        await this.revoke(session)
      } catch (error) {
        remoteError = error
      }
    }

    await this.dependencies.sessionStore.clear()
    if (remoteError) throw remoteError
  }

  private async startHostedAuth(
    redirectUri: string,
    state: string,
    codeChallenge: string,
  ): Promise<HostedAuthStart> {
    const payload = await postJson(this.dependencies.fetch, '/v1/auth/start', {
      client_key: this.apiKey,
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })
    const authUrl = payload.auth_url

    if (typeof authUrl !== 'string' || !sameOrigin(authUrl, HOSTED_AUTH_BASE_URL)) {
      throw new TheFaithAuthError(
        'invalid_response',
        'The server returned an invalid hosted auth URL.',
      )
    }
    return { authUrl }
  }

  private async exchangeCode(
    code: string,
    redirectUri: string,
    codeVerifier: string,
  ): Promise<TheFaithAuthSession> {
    const payload = await postJson(this.dependencies.fetch, '/v1/auth/token', {
      client_key: this.apiKey,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    })

    try {
      return parseSession({ ...payload, received_at: new Date().toISOString() })
    } catch (cause) {
      throw new TheFaithAuthError(
        'invalid_response',
        'The token response is incomplete.',
        { cause },
      )
    }
  }

  private async revoke(session: TheFaithAuthSession): Promise<void> {
    await postJson(
      this.dependencies.fetch,
      '/v1/auth/logout',
      {},
      {
        'X-API-Key': this.apiKey,
        Authorization: `${session.tokenType} ${session.accessToken}`,
      },
    )
  }
}

export function callbackUriForApplicationId(applicationId: string): string {
  const normalized = applicationId.trim().toLowerCase()
  const scheme = `${normalized}.thefaithapp`
  if (!/^[a-z][a-z0-9+.-]*$/.test(scheme)) {
    throw new TheFaithAuthError(
      'configuration',
      'The application ID cannot be converted into a callback URI. Use an application ID containing only letters, numbers, dots, or hyphens.',
    )
  }
  return `${scheme}://auth/callback`
}

async function postJson(
  fetchImplementation: FetchImplementation,
  path: string,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): Promise<Record<string, unknown>> {
  let response: Response
  try {
    response = await fetchImplementation(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    })
  } catch (cause) {
    throw new TheFaithAuthError(
      'network',
      'The TheFaithApp API could not be reached.',
      { cause },
    )
  }

  const payload = await decodeResponse(response)
  if (!response.ok) {
    throw new TheFaithAuthError('server', errorMessage(payload), {
      statusCode: response.status,
    })
  }
  return payload
}

async function decodeResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text()
  if (!text.trim()) return {}

  try {
    const decoded: unknown = JSON.parse(text)
    if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)) {
      return decoded as Record<string, unknown>
    }
  } catch {
    // Converted into a stable SDK error below.
  }

  throw new TheFaithAuthError(
    'invalid_response',
    'The TheFaithApp API returned an invalid response.',
    { statusCode: response.status },
  )
}

function errorMessage(payload: Record<string, unknown>): string {
  for (const key of ['message', 'error_message', 'error']) {
    const value = payload[key]
    if (typeof value === 'string' && value) return value
  }

  const errors = payload.errors
  if (errors && typeof errors === 'object' && !Array.isArray(errors)) {
    for (const value of Object.values(errors)) {
      if (typeof value === 'string' && value) return value
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
    }
  }
  return 'The hosted authentication request failed.'
}

function validateCallbackUri(value: string): string {
  try {
    const url = new URL(value)
    if (!url.protocol) throw new Error('Missing scheme')
    return value
  } catch (cause) {
    throw new TheFaithAuthError(
      'configuration',
      'The hosted auth redirect URI must include a valid scheme.',
      { cause },
    )
  }
}

function callbacksMatch(actualValue: string, expectedValue: string): boolean {
  try {
    const actual = new URL(actualValue)
    const expected = new URL(expectedValue)
    if (
      actual.protocol.toLowerCase() !== expected.protocol.toLowerCase() ||
      actual.hostname.toLowerCase() !== expected.hostname.toLowerCase() ||
      actual.port !== expected.port ||
      actual.pathname !== expected.pathname
    ) {
      return false
    }

    for (const [key, value] of expected.searchParams) {
      if (actual.searchParams.get(key) !== value) return false
    }
    return true
  } catch {
    return false
  }
}

function sameOrigin(firstValue: string, secondValue: string): boolean {
  try {
    const first = new URL(firstValue)
    const second = new URL(secondValue)
    return (
      first.protocol.toLowerCase() === second.protocol.toLowerCase() &&
      first.hostname.toLowerCase() === second.hostname.toLowerCase() &&
      first.port === second.port
    )
  } catch {
    return false
  }
}

function constantTimeEquals(first: string, second: string): boolean {
  let difference = first.length ^ second.length
  const length = Math.max(first.length, second.length)
  for (let index = 0; index < length; index += 1) {
    difference |= (first.charCodeAt(index) || 0) ^ (second.charCodeAt(index) || 0)
  }
  return difference === 0
}
