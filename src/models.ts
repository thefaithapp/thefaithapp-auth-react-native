export interface TheFaithMember {
  id: number
  name: string
  email?: string | null
  clientId: number
  uuid: string
}

export interface TheFaithAuthSession {
  accessToken: string
  tokenType: string
  member: TheFaithMember
  receivedAt: string
  expiresAt?: string | null
}

export function sessionIsExpired(session: TheFaithAuthSession): boolean {
  if (!session.expiresAt) return false
  return new Date(session.expiresAt).getTime() < Date.now()
}

export function parseSession(value: unknown): TheFaithAuthSession {
  const payload = requiredRecord(value, 'Session response')
  const member = requiredRecord(payload.member, 'Session member')

  return {
    accessToken: requiredString(payload.access_token, 'access_token'),
    tokenType: requiredString(payload.token_type, 'token_type'),
    member: {
      id: requiredNumber(member.id, 'member.id'),
      name: requiredString(member.name, 'member.name'),
      email:
        member.email === null || member.email === undefined
          ? null
          : requiredString(member.email, 'member.email'),
      clientId: requiredNumber(member.client_id, 'member.client_id'),
      uuid: requiredString(member.uuid, 'member.uuid'),
    },
    receivedAt:
      optionalDate(payload.received_at) ?? new Date().toISOString(),
    expiresAt: optionalDate(payload.expires_at),
  }
}

export function serializeSession(session: TheFaithAuthSession): object {
  return {
    access_token: session.accessToken,
    token_type: session.tokenType,
    member: {
      id: session.member.id,
      name: session.member.name,
      email: session.member.email ?? null,
      client_id: session.member.clientId,
      uuid: session.member.uuid,
    },
    received_at: session.receivedAt,
    ...(session.expiresAt ? { expires_at: session.expiresAt } : {}),
  }
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} is missing.`)
  }
  return value as Record<string, unknown>
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} is missing.`)
  }
  return value
}

function requiredNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} is missing.`)
  }
  return value
}

function optionalDate(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString()
}
