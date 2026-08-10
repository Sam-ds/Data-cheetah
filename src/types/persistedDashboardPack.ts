/** IndexedDB row for user-installed Discover packs. */
export interface PersistedDashboardPack {
  id: string
  metaJson: string
  ruleJson: string
  sampleCsv?: string
  /** JSON array of { name, csv } */
  samplesJson?: string
  /** Source from the pack's sandboxed visualization.js entry. */
  visualizationJs?: string
  installedAt: Date
}
