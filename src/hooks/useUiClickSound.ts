import { useEffect } from 'react'
import { playClick } from '@/lib/audio/uiSounds'

function isInteractiveTarget(el: Element | null): boolean {
  if (!el) return false
  const control = el.closest('button, a[href], [role="button"]')
  if (!control) return false
  if (control instanceof HTMLButtonElement && control.disabled) return false
  if (control.getAttribute('aria-disabled') === 'true') return false
  if (control.closest('input, textarea, select, [contenteditable="true"]')) return false
  return true
}

/** Soft click feedback for primary presses inside the app shell. */
export function useUiClickSound(): void {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const target = event.target
      if (!(target instanceof Element)) return
      if (!isInteractiveTarget(target)) return
      playClick()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [])
}
