/** Local named workspace (on-device profile — no cloud login). */
export interface LocalWorkspace {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export const DEFAULT_WORKSPACE_NAME = 'Personal'
