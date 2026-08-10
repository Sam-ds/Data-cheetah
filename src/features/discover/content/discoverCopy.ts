/** One-line Discover pitch used on Home and Discover. */
export const DISCOVER_BLURB =
  'Your data and ready-made templates — instant visualization'

/** One-time tip popup on Discover browse. */
export const DISCOVER_PACK_TIP = {
  eyebrow: 'Community packs',
  title: 'Install more packs — or ship your own',
  body: [
    'Use Install template to add more Open Dashboard packs from a ZIP on this device.',
    'If you are a developer, you can create your own dashboard pack and install it here — just follow DataCheetah’s Open Dashboard standards.',
  ],
  developersCta: 'For developers',
  dismissCta: 'Got it',
} as const

export const DISCOVER_PACK_TIP_SEEN_KEY = 'datacheetah-discover-pack-tip-seen-v2'

export function hasSeenDiscoverPackTip(): boolean {
  try {
    return localStorage.getItem(DISCOVER_PACK_TIP_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markDiscoverPackTipSeen(): void {
  try {
    localStorage.setItem(DISCOVER_PACK_TIP_SEEN_KEY, '1')
  } catch {
    /* ignore quota / private mode */
  }
}
