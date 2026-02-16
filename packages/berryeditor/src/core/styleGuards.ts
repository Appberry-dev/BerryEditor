const FONT_FAMILY_PATTERN = /^[A-Za-z0-9\s'",._-]+$/

function parseFiniteNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

/**
 * Parses a numeric value and returns it when it falls within the provided range.
 * The returned number is rounded to two decimals.
 */
export function parseRoundedNumberInRange(
  value: string | number | null | undefined,
  min: number,
  max: number
): number | null {
  const numeric = parseFiniteNumber(value)
  if (numeric === null || numeric < min || numeric > max) return null
  return Math.round(numeric * 100) / 100
}

/**
 * Parses a line-height value constrained to the editor-supported interval.
 */
export function parseSafeLineHeightValue(value: string | number | null | undefined): number | null {
  const numeric = parseFiniteNumber(value)
  if (numeric === null || numeric < 1 || numeric > 3) return null
  return numeric
}

/**
 * Parses a font size in px, accepting an optional `px` suffix.
 */
export function parseSafeFontSizeValue(value: string | null | undefined): number | null {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null
  const normalized = trimmed.endsWith('px') ? trimmed.slice(0, -2).trim() : trimmed
  return parseRoundedNumberInRange(normalized, 8, 96)
}

/**
 * Normalizes and validates a font-family CSS value that can be safely applied inline.
 */
export function parseSafeFontFamily(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) return null
  if (normalized.length > 160) return null
  if (!FONT_FAMILY_PATTERN.test(normalized)) return null
  return normalized
}
