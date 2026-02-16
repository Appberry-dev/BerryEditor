import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useLatest } from './hooks'
import type { ColorPickerAdapter, ColorPickerAdapterHandle, ColorPickerRenderProps } from './types'

type ColorPickerAdapterHostProps = ColorPickerRenderProps & {
  adapter: ColorPickerAdapter
  fallback: ReactElement
}

/**
 * Mounts a color-picker adapter and falls back to a React picker when adapter lifecycle fails.
 */
export function ColorPickerAdapterHost({
  adapter,
  fallback,
  kind,
  value,
  disabled,
  swatches,
  onCommit,
  onClear,
  onClose
}: ColorPickerAdapterHostProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const handleRef = useRef<ColorPickerAdapterHandle | null>(null)
  const [failed, setFailed] = useState(false)
  const latestContext = useLatest({
    kind,
    value,
    disabled,
    swatches,
    onCommit,
    onClear,
    onClose
  })

  useEffect(() => {
    if (failed) return
    const container = containerRef.current
    if (!container) return

    const mountContext = latestContext.current
    try {
      const handle = adapter.mount({
        container,
        ...mountContext
      })
      handleRef.current = handle ?? null
    } catch {
      setFailed(true)
      return
    }

    return () => {
      try {
        handleRef.current?.destroy?.()
      } catch {
        // Adapter cleanup failures should not break toolbar unmount.
      } finally {
        handleRef.current = null
      }
    }
  }, [adapter, failed, latestContext])

  useEffect(() => {
    if (failed) return
    const handle = handleRef.current
    if (!handle?.update) return

    try {
      handle.update({
        kind,
        value,
        disabled,
        swatches,
        onCommit,
        onClear,
        onClose
      })
    } catch {
      setFailed(true)
    }
  }, [disabled, failed, kind, onClear, onClose, onCommit, swatches, value])

  if (failed) return fallback

  return <div ref={containerRef} className={`berry-toolbar__color-picker-host${disabled ? ' is-disabled' : ''}`} />
}
