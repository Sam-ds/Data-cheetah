import type { DashboardColumnRole, DashboardRule } from '@/types/dashboardPack'

export type ColumnMapping = Record<string, string> // role → actual header

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

/** Match CSV headers to rule roles via aliases (exact / normalized). */
export function mapColumnsToRoles(
  headers: string[],
  roles: DashboardColumnRole[],
): { mapping: ColumnMapping; missing: string[]; unmatchedHeaders: string[] } {
  const mapping: ColumnMapping = {}
  const used = new Set<string>()
  const missing: string[] = []

  for (const role of roles) {
    const candidates = [role.role, ...role.aliases].map(norm)
    const hit = headers.find((h) => !used.has(h) && candidates.includes(norm(h)))
    if (hit) {
      mapping[role.role] = hit
      used.add(hit)
    } else {
      missing.push(role.role)
    }
  }

  return {
    mapping,
    missing,
    unmatchedHeaders: headers.filter((h) => !used.has(h)),
  }
}

export function mappingComplete(mapping: ColumnMapping, rule: DashboardRule): boolean {
  const cols = rule.requiredColumns ?? rule.tables?.[0]?.requiredColumns ?? []
  return cols.every((c) => Boolean(mapping[c.role]))
}
