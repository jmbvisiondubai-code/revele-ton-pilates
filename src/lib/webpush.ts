// Web Push implementation using only Web Crypto API (no npm packages)
// Implements the aesgcm content encoding (RFC 8291 / draft-ietf-webpush-encryption-04)

const enc = new TextEncoder()

// Ensure we always have a plain ArrayBuffer (not SharedArrayBuffer)
function toAB(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer
}

function b64u(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return Buffer.from(bytes).toString('base64url')
}

function db64u(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'base64url'))
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0)
  const out = new Uint8Array(total)
  let i = 0
  for (const a of arrays) { out.set(a, i); i += a.length }
  return out
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', toAB(ikm), 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: toAB(salt), info: toAB(info) }, key, len * 8)
  return new Uint8Array(bits)
}

async function vapidJWT(endpoint: string, subject: string, pubKeyB64u: string, privKeyB64u: string): Promise<string> {
  const pubBytes = db64u(pubKeyB64u)
  const x = b64u(pubBytes.slice(1, 33))
  const y = b64u(pubBytes.slice(33, 65))

  const signingKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: privKeyB64u, x, y },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  const url = new URL(endpoint)
  const header  = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = b64u(enc.encode(JSON.stringify({
    aud: url.origin,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: subject,
  })))

  const input = `${header}.${payload}`
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, toAB(enc.encode(input)))
  return `${input}.${b64u(sig)}`
}

export async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
): Promise<{ ok: boolean; status: number }> {
  // ── VAPID JWT ────────────────────────────────────────────────────────────
  const jwt = await vapidJWT(sub.endpoint, vapidSubject, vapidPublicKey, vapidPrivateKey)

  // ── Content encryption (aesgcm) ──────────────────────────────────────────
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // Server ephemeral ECDH key pair
  const serverKP = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKP.publicKey))

  // Subscriber's public key
  const subPubBytes = db64u(sub.p256dh)
  const subPubKey = await crypto.subtle.importKey('raw', toAB(subPubBytes), { name: 'ECDH', namedCurve: 'P-256' }, false, [])

  // ECDH shared secret
  const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: subPubKey }, serverKP.privateKey, 256)
  const authSecret = db64u(sub.auth)

  // PRK
  const prk = await hkdf(authSecret, new Uint8Array(sharedBits), enc.encode('Content-Encoding: auth\0'), 32)

  // Context = 'P-256\0' + uint16be(len) + receiverPub + uint16be(len) + senderPub
  const context = concat(
    enc.encode('P-256\0'),
    new Uint8Array([0, subPubBytes.length]),
    subPubBytes,
    new Uint8Array([0, serverPubRaw.length]),
    serverPubRaw,
  )

  const cek   = await hkdf(salt, prk, concat(enc.encode('Content-Encoding: aesgcm\0'), context), 16)
  const nonce = await hkdf(salt, prk, concat(enc.encode('Content-Encoding: nonce\0'),  context), 12)

  // Pad + encrypt
  const plaintext = enc.encode(payload)
  const padded = new Uint8Array(plaintext.length + 2) // 2-byte zero padding length prefix
  padded.set(plaintext, 2)

  const cekKey    = await crypto.subtle.importKey('raw', toAB(cek), 'AES-GCM', false, ['encrypt'])
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toAB(nonce) }, cekKey, toAB(padded))

  // ── POST to push endpoint ────────────────────────────────────────────────
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type':     'application/octet-stream',
      'Content-Encoding': 'aesgcm',
      'Encryption':       `salt=${b64u(salt)}`,
      'Crypto-Key':       `dh=${b64u(serverPubRaw)};p256ecdsa=${vapidPublicKey}`,
      'Authorization':    `vapid t=${jwt},k=${vapidPublicKey}`,
      'TTL':              '2419200',
    },
    body: encrypted,
  })

  return { ok: res.ok || res.status === 201, status: res.status }
}
