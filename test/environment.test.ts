import { describe, expect, it } from 'vitest'
import { parseEnvironmentOrigin } from '../src/environment'

describe('development SDK origins', () => {
  it.each([
    ['https://api.thefaithapp.com/', 'https://api.thefaithapp.com'],
    ['http://127.0.0.1:8000', 'http://127.0.0.1:8000'],
    ['http://localhost:3001/', 'http://localhost:3001'],
    ['http://[::1]:8000', 'http://[::1]:8000'],
  ])('accepts origin %s', (input, expected) => {
    expect(parseEnvironmentOrigin(input)).toBe(expected)
  })

  it.each([
    'http://api.thefaithapp.com',
    'http://127.0.0.1.evil.test',
    'https://user:password@api.thefaithapp.com',
    'https://api.thefaithapp.com/v1',
    'https://api.thefaithapp.com?token=value',
    'https://api.thefaithapp.com#fragment',
    'file:///tmp/test',
    'not a URL',
  ])('rejects unsafe origin %s', (input) => {
    expect(() => parseEnvironmentOrigin(input)).toThrowError(
      expect.objectContaining({ code: 'configuration' }),
    )
  })
})
