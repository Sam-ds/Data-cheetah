export interface Preferences {
  id: string
  theme: 'light' | 'dark'
  layout: {
    sidebarSize: number
    bottomSize: number
    rightSize: number
    sidebarCollapsed: boolean
  }
  editorSettings: {
    fontSize: number
    wordWrap: boolean
  }
  defaultRowLimit: number
  updatedAt: Date
}

export const DEFAULT_PREFERENCES: Preferences = {
  id: 'default',
  theme: 'light',
  layout: {
    sidebarSize: 20,
    bottomSize: 40,
    rightSize: 25,
    sidebarCollapsed: false,
  },
  editorSettings: {
    fontSize: 13,
    wordWrap: true,
  },
  defaultRowLimit: 10000,
  updatedAt: new Date(),
}
