export type { SecretsVaultRecord } from '@/types/secretsVault'

/**
 * Passphrase-protected secrets vault using Web Crypto (PBKDF2 + AES-GCM).
 * Ciphertext lives in IndexedDB; the derived CryptoKey stays in memory only after unlock.
 */

import { db } from '@/lib/db/dexie'
import type { AskSecretsPayload } from '@/types/askSettings'
import { EMPTY_ASK_SECRETS } from '@/types/askSettings'
import type { SecretsVaultRecord } from '@/types/secretsVault'
import { useVaultSessionStore } from '@/features/settings/store/vaultSessionStore'

const VAULT_ID = 'default'
const PBKDF2_ITERATIONS = 310_000
const VERIFIER_PLAINTEXT = 'datacheetah-vault-v1'

let sessionKey: CryptoKey | null = null
let sessionSecrets: AskSecretsPayload | null = null

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
  return btoa(s)
}

function b64ToBuf(b64: string): ArrayBuffer {
  const s = atob(b64)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes.buffer
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const material = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encryptString(key: CryptoKey, plaintext: string): Promise<{ ivB64: string; cipherB64: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  )
  return { ivB64: bufToB64(iv.buffer), cipherB64: bufToB64(cipher) }
}

async function decryptString(key: CryptoKey, ivB64: string, cipherB64: string): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(b64ToBuf(ivB64)) },
    key,
    b64ToBuf(cipherB64),
  )
  return new TextDecoder().decode(plain)
}

export function isVaultUnlocked(): boolean {
  return sessionKey != null && sessionSecrets != null
}

export function getUnlockedSecrets(): AskSecretsPayload | null {
  return sessionSecrets ? { ...sessionSecrets } : null
}

export function lockVault(): void {
  sessionKey = null
  sessionSecrets = null
  useVaultSessionStore.getState().setUnlocked(false)
}

export async function vaultExists(): Promise<boolean> {
  const row = await db.secretsVault.get(VAULT_ID)
  return !!row
}

/** Create a new vault. Fails if one already exists. */
export async function createVault(passphrase: string): Promise<void> {
  if (passphrase.length < 8) {
    throw new Error('Passphrase must be at least 8 characters')
  }
  if (await vaultExists()) {
    throw new Error('Vault already exists — unlock it instead')
  }

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS)
  const verifier = await encryptString(key, VERIFIER_PLAINTEXT)
  const secrets = await encryptString(key, JSON.stringify(EMPTY_ASK_SECRETS))

  const record: SecretsVaultRecord = {
    id: VAULT_ID,
    saltB64: bufToB64(salt.buffer),
    verifierIvB64: verifier.ivB64,
    verifierCipherB64: verifier.cipherB64,
    secretsIvB64: secrets.ivB64,
    secretsCipherB64: secrets.cipherB64,
    iterations: PBKDF2_ITERATIONS,
    updatedAt: new Date(),
  }
  await db.secretsVault.put(record)
  sessionKey = key
  sessionSecrets = { ...EMPTY_ASK_SECRETS }
  useVaultSessionStore.getState().setUnlocked(true)
}

export async function unlockVault(passphrase: string): Promise<AskSecretsPayload> {
  const row = await db.secretsVault.get(VAULT_ID)
  if (!row) throw new Error('No secrets vault yet — create one in Settings')

  const salt = new Uint8Array(b64ToBuf(row.saltB64))
  const key = await deriveKey(passphrase, salt, row.iterations || PBKDF2_ITERATIONS)

  try {
    const check = await decryptString(key, row.verifierIvB64, row.verifierCipherB64)
    if (check !== VERIFIER_PLAINTEXT) throw new Error('bad')
  } catch {
    throw new Error('Incorrect passphrase')
  }

  const json = await decryptString(key, row.secretsIvB64, row.secretsCipherB64)
  let secrets: AskSecretsPayload
  try {
    secrets = JSON.parse(json) as AskSecretsPayload
  } catch {
    secrets = { ...EMPTY_ASK_SECRETS }
  }

  sessionKey = key
  sessionSecrets = secrets
  useVaultSessionStore.getState().setUnlocked(true)
  return { ...secrets }
}

export async function saveUnlockedSecrets(next: AskSecretsPayload): Promise<void> {
  if (!sessionKey) throw new Error('Unlock the secrets vault first')
  const row = await db.secretsVault.get(VAULT_ID)
  if (!row) throw new Error('Vault missing')

  const cleaned: AskSecretsPayload = {
    openaiApiKey: next.openaiApiKey?.trim() || undefined,
    anthropicApiKey: next.anthropicApiKey?.trim() || undefined,
    geminiApiKey: next.geminiApiKey?.trim() || undefined,
    kimiApiKey: next.kimiApiKey?.trim() || undefined,
    openaiCompatibleApiKey: next.openaiCompatibleApiKey?.trim() || undefined,
    openaiCompatibleBaseUrl: next.openaiCompatibleBaseUrl?.trim() || undefined,
  }

  const encrypted = await encryptString(sessionKey, JSON.stringify(cleaned))
  await db.secretsVault.put({
    ...row,
    secretsIvB64: encrypted.ivB64,
    secretsCipherB64: encrypted.cipherB64,
    updatedAt: new Date(),
  })
  sessionSecrets = cleaned
}

/** Permanently delete vault ciphertext and lock session. */
export async function destroyVault(): Promise<void> {
  await db.secretsVault.delete(VAULT_ID)
  lockVault()
}

export function maskSecret(value: string | undefined): string {
  if (!value) return ''
  if (value.length <= 8) return '••••••••'
  return `${value.slice(0, 3)}••••${value.slice(-4)}`
}

export function hasAnyApiKey(secrets: AskSecretsPayload): boolean {
  return !!(
    secrets.openaiApiKey ||
    secrets.anthropicApiKey ||
    secrets.geminiApiKey ||
    secrets.kimiApiKey ||
    secrets.openaiCompatibleApiKey
  )
}
