export type TheFaithAuthErrorCode =
  | 'configuration'
  | 'network'
  | 'cancelled'
  | 'server'
  | 'invalid_response'
  | 'state_mismatch'
  | 'callback_mismatch'
  | 'missing_authorization_code'
  | 'session_storage'
  | 'not_authenticated'
  | 'sign_in_in_progress'
  | 'unauthorized_host'

export class TheFaithAuthError extends Error {
  readonly code: TheFaithAuthErrorCode
  readonly statusCode?: number
  readonly cause?: unknown

  constructor(
    code: TheFaithAuthErrorCode,
    message: string,
    options: { statusCode?: number; cause?: unknown } = {},
  ) {
    super(message)
    this.name = 'TheFaithAuthError'
    this.code = code
    this.statusCode = options.statusCode
    this.cause = options.cause
  }
}
