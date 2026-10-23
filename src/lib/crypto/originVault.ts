import { db } from '@/lib/db/dexie'
import type { OriginSecretRecord } from '@/types/originVault'

const MASTER_KEY_ID = 'master'
const IV_BYTES = 12
const TEXT_ENCODER = new TextEncoder()
const TEXT_DECODER = new TextDecoder()

export type VaultPurpose = 'openrouter-api-key' | 'dataset-blob'

function requireSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error('Web Crypto is unavailable. Serve DataCheetah over HTTPS (or localhost) to encrypt local data.')
  }
  return subtle
}

function aadBuffer(purpose: VaultPurpose, extra?: string): ArrayBuffer {
  const origin = typeof location !== 'undefined' ? location.origin : 'datacheetah'
  return copyBuffer(TEXT_ENCODER.encode(`datacheetah.v1|${origin}|${purpose}|${extra ?? ''}`))
}

function copyBuffer(view: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(view.byteLength)
  new Uint8Array(out).set(view)
  return out
}

async function getMasterKey(): Promise<CryptoKey> {
  const subtle = requireSubtle()
  const existing = await db.cryptoKeys.get(MASTER_KEY_ID)
  if (existing?.key) return existing.key
  const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  await db.cryptoKeys.put({ id: MASTER_KEY_ID, key, createdAt: new Date() })
  return key
}

export async function encryptBytes(
  plain: ArrayBuffer,
  purpose: VaultPurpose,
  extra?: string,
): Promise<{ iv: ArrayBuffer; ciphertext: ArrayBuffer }> {
  const subtle = requireSubtle()
  const key = await getMasterKey()
  const iv = new ArrayBuffer(IV_BYTES)
  crypto.getRandomValues(new Uint8Array(iv))
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aadBuffer(purpose, extra) },
    key,
    plain,
  )
  return { iv, ciphertext }
}

export async function decryptBytes(
  iv: ArrayBuffer,
  ciphertext: ArrayBuffer,
  purpose: VaultPurpose,
  extra?: string,
): Promise<ArrayBuffer> {
  const subtle = requireSubtle()
  const key = await getMasterKey()
  return subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: aadBuffer(purpose, extra) },
    key,
    ciphertext,
  )
}

export async function putSecret(id: VaultPurpose, value: string): Promise<void> {
  const trimmed = value.trim()
  if (!trimmed) {
    await db.secrets.delete(id)
    return
  }
  const encoded = TEXT_ENCODER.encode(trimmed)
  const { iv, ciphertext } = await encryptBytes(copyBuffer(encoded), id)
  const record: OriginSecretRecord = {
    id,
    iv,
    ciphertext,
    updatedAt: new Date(),
  }
  await db.secrets.put(record)
}

export async function getSecret(id: VaultPurpose): Promise<string> {
  const row = await db.secrets.get(id)
  if (!row) return ''
  try {
    const plain = await decryptBytes(row.iv, row.ciphertext, id)
    return TEXT_DECODER.decode(plain).trim()
  } catch {
    return ''
  }
}

export async function deleteSecret(id: VaultPurpose): Promise<void> {
  await db.secrets.delete(id)
}
