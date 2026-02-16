import { useMemo, useRef } from 'react'
import type { FontFamilyOption } from './types'

/**
 * Built-in font-family options shown by the toolbar.
 */
export const DEFAULT_FONT_FAMILY_OPTIONS: ReadonlyArray<FontFamilyOption> = [
  { label: 'Default', value: '' },
  { label: 'IBM Plex Sans', value: '"IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif' },
  { label: 'Georgia', value: 'Georgia, Cambria, "Times New Roman", serif' },
  { label: 'Arial', value: 'Arial, "Helvetica Neue", Helvetica, sans-serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' }
]

function normalizeFontFamilyOption(option: FontFamilyOption): FontFamilyOption | null {
  const label = option.label.trim()
  const value = option.value.trim()
  if (!label) return null
  return { label, value }
}

/**
 * Merges user-provided font families with defaults, deduping by CSS value.
 */
export function useBerryFontFamilies(extensions?: FontFamilyOption[]): FontFamilyOption[] {
  return useMemo(() => {
    const merged = new Map<string, FontFamilyOption>()
    for (const option of DEFAULT_FONT_FAMILY_OPTIONS) {
      merged.set(option.value, { ...option })
    }
    for (const option of extensions ?? []) {
      const normalized = normalizeFontFamilyOption(option)
      if (!normalized) continue
      merged.set(normalized.value, normalized)
    }
    return Array.from(merged.values())
  }, [extensions])
}

/**
 * Stores the latest value in a stable ref.
 */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value)
  ref.current = value
  return ref
}
