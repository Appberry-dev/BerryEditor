import { describe, expect, it } from 'vitest'
import {
  isSafeFontFamily,
  isSafeFontSize,
  isSafeHexColor,
  isSafeLineHeight,
  isSafeTableDimension
} from '../src/core/commands'

describe('command validators', () => {
  it('validates strict hex colors', () => {
    expect(isSafeHexColor('#fff')).toBe(true)
    expect(isSafeHexColor('#A1B2C3')).toBe(true)
    expect(isSafeHexColor('red')).toBe(false)
    expect(isSafeHexColor('#12')).toBe(false)
  })

  it('validates line-height range', () => {
    expect(isSafeLineHeight('1')).toBe(true)
    expect(isSafeLineHeight('2.4')).toBe(true)
    expect(isSafeLineHeight('0.9')).toBe(false)
    expect(isSafeLineHeight('3.1')).toBe(false)
    expect(isSafeLineHeight('abc')).toBe(false)
  })

  it('validates font-family values', () => {
    expect(isSafeFontFamily('')).toBe(true)
    expect(isSafeFontFamily('"IBM Plex Sans", sans-serif')).toBe(true)
    expect(isSafeFontFamily('Georgia, serif')).toBe(true)
    expect(isSafeFontFamily('url(javascript:alert(1))')).toBe(false)
    expect(isSafeFontFamily('font;position:absolute')).toBe(false)
  })

  it('validates font-size range', () => {
    expect(isSafeFontSize('8')).toBe(true)
    expect(isSafeFontSize('16px')).toBe(true)
    expect(isSafeFontSize('96')).toBe(true)
    expect(isSafeFontSize('7')).toBe(false)
    expect(isSafeFontSize('97')).toBe(false)
    expect(isSafeFontSize('abc')).toBe(false)
  })

  it('validates table bounds', () => {
    expect(isSafeTableDimension(1)).toBe(true)
    expect(isSafeTableDimension(10)).toBe(true)
    expect(isSafeTableDimension(0)).toBe(false)
    expect(isSafeTableDimension(11)).toBe(false)
    expect(isSafeTableDimension(2.5)).toBe(false)
  })
})
