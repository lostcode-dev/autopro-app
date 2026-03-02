import { createHash, randomBytes } from 'node:crypto'

function base64UrlEncode(input: Buffer) {
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

export function createPkcePair() {
  const codeVerifier = base64UrlEncode(randomBytes(32))
  const codeChallenge = base64UrlEncode(createHash('sha256').update(codeVerifier).digest())

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 's256' as const
  }
}
