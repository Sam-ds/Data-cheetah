import * as echarts from 'echarts'

export type MapId = 'world' | 'usa-states'

const registered = new Set<string>()
const inflight = new Map<string, Promise<void>>()

function geoUrl(mapId: MapId): string {
  const root = import.meta.env.BASE_URL || '/'
  const base = root.endsWith('/') ? root : `${root}/`
  return `${base}geo/${mapId === 'world' ? 'world' : 'usa-states'}.json`
}

/** Fetch and register a choropleth map with ECharts (idempotent). */
export async function ensureMapRegistered(mapId: MapId = 'world'): Promise<void> {
  if (registered.has(mapId)) return
  const existing = inflight.get(mapId)
  if (existing) return existing

  const promise = (async () => {
    const res = await fetch(geoUrl(mapId))
    if (!res.ok) throw new Error(`Failed to load map "${mapId}" (${res.status})`)
    const geoJson = await res.json()
    echarts.registerMap(mapId, geoJson as Parameters<typeof echarts.registerMap>[1])
    registered.add(mapId)
  })()

  inflight.set(mapId, promise)
  try {
    await promise
  } finally {
    inflight.delete(mapId)
  }
}
