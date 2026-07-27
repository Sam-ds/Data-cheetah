/** Plaintext / ciphertext shapes for the encrypted secrets vault (IndexedDB). */

export interface SecretsVaultRecord {
  id: string
  /** base64 salt for PBKDF2 */
  saltB64: string
  /** base64 IV for verifier ciphertext */
  verifierIvB64: string
  /** base64 AES-GCM ciphertext of vault verifier string */
  verifierCipherB64: string
  /** base64 IV for secrets blob */
  secretsIvB64: string
  /** base64 AES-GCM ciphertext of JSON AskSecretsPayload */
  secretsCipherB64: string
  iterations: number
  updatedAt: Date
}
