/** Non-extractable AES-GCM wrapping key, kept in IndexedDB for this origin only. */
export interface OriginCryptoKeyRecord {
  id: string
  key: CryptoKey
  createdAt: Date
}

/** AES-GCM ciphertext for a named secret (API keys). */
export interface OriginSecretRecord {
  id: string
  iv: ArrayBuffer
  ciphertext: ArrayBuffer
  updatedAt: Date
}

/** Per-dataset encryption envelope stored alongside ciphertext bytes. */
export interface DatasetCryptoMeta {
  v: 1
  iv: ArrayBuffer
}
