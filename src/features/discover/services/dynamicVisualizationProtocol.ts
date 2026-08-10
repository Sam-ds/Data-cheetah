import type {
  DynamicVisualizationId,
  DynamicVisualizationSetting,
} from '@/types/dashboardPack'

export const DYNAMIC_MESSAGE_SOURCE = 'datacheetah-dynamic-v1'
export const MAX_DYNAMIC_ROWS = 2000
export const MAX_DYNAMIC_PAYLOAD_BYTES = 2 * 1024 * 1024

export interface DynamicVisualizationPayload {
  visualizationId: DynamicVisualizationId
  title: string
  columns: string[]
  rows: Record<string, unknown>[]
  settings?: Record<string, DynamicVisualizationSetting>
  theme: 'light' | 'dark'
}

export type DynamicHostMessage =
  | { source: typeof DYNAMIC_MESSAGE_SOURCE; type: 'ready' }
  | { source: typeof DYNAMIC_MESSAGE_SOURCE; type: 'resize'; height: number }
  | { source: typeof DYNAMIC_MESSAGE_SOURCE; type: 'error'; message: string }

export interface DynamicRenderMessage {
  source: typeof DYNAMIC_MESSAGE_SOURCE
  type: 'render'
  payload: DynamicVisualizationPayload
}

export function isDynamicHostMessage(value: unknown): value is DynamicHostMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Record<string, unknown>
  if (message.source !== DYNAMIC_MESSAGE_SOURCE) return false
  if (message.type === 'ready') return true
  if (message.type === 'resize') {
    return typeof message.height === 'number' && Number.isFinite(message.height)
  }
  return message.type === 'error' && typeof message.message === 'string'
}

export function dynamicPayloadSize(payload: DynamicVisualizationPayload): number {
  return new Blob([JSON.stringify(payload, (_, value) =>
    typeof value === 'bigint' ? Number(value) : value,
  )]).size
}
