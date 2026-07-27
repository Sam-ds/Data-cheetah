export interface ModelCatalogEntry {
  id: string
  label: string
  /** Rough download / VRAM hint for the UI */
  sizeHint: string
  description: string
}

/**
 * Curated WebLLM models — edit this list to change what users can pick.
 * IDs must exist in @mlc-ai/web-llm prebuiltAppConfig.model_list.
 */
export const ASK_MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    label: 'Llama 3.2 1B',
    sizeHint: '~0.7 GB',
    description: 'Fastest; good for short SQL Q&A on modest GPUs',
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    label: 'Llama 3.2 3B',
    sizeHint: '~1.5 GB',
    description: 'Better reasoning; needs more VRAM',
  },
  {
    id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    label: 'Phi 3.5 Mini',
    sizeHint: '~2 GB',
    description: 'Strong small instruct model',
  },
  {
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 1.5B',
    sizeHint: '~1 GB',
    description: 'Compact alternative for SQL-style tasks',
  },
]

export const DEFAULT_ASK_MODEL_ID = ASK_MODEL_CATALOG[0].id

export function getModelEntry(id: string): ModelCatalogEntry | undefined {
  return ASK_MODEL_CATALOG.find((m) => m.id === id)
}
