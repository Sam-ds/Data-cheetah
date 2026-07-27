/// <reference lib="webworker" />

import { parseOne, transpileOne } from 'sqlglot-ts'
import 'sqlglot-ts/dialects/duckdb'
import type { SqlglotRequest, SqlglotResponse } from './types/messages'

function respond(response: SqlglotResponse) {
  self.postMessage(response)
}

self.onmessage = async (event: MessageEvent<SqlglotRequest>) => {
  const msg = event.data

  try {
    switch (msg.type) {
      case 'FORMAT': {
        try {
          const formatted = transpileOne(msg.payload.sql, { read: 'duckdb', write: 'duckdb', pretty: true })
          respond({ id: msg.id, type: 'FORMAT_RESULT', payload: { sql: formatted } })
        } catch {
          respond({ id: msg.id, type: 'FORMAT_RESULT', payload: { sql: msg.payload.sql } })
        }
        break
      }

      case 'LINT': {
        const errors: { line: number; column: number; message: string }[] = []
        try {
          parseOne(msg.payload.sql, { dialect: 'duckdb' })
          respond({ id: msg.id, type: 'LINT_RESULT', payload: { valid: true, errors: [] } })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          errors.push({ line: 1, column: 1, message })
          respond({ id: msg.id, type: 'LINT_RESULT', payload: { valid: false, errors } })
        }
        break
      }

      case 'PARSE': {
        try {
          parseOne(msg.payload.sql, { dialect: 'duckdb' })
          respond({ id: msg.id, type: 'PARSE_RESULT', payload: { valid: true } })
        } catch {
          respond({ id: msg.id, type: 'PARSE_RESULT', payload: { valid: false } })
        }
        break
      }
    }
  } catch (error) {
    respond({
      id: msg.id,
      type: 'ERROR',
      payload: { message: error instanceof Error ? error.message : String(error) },
    })
  }
}
