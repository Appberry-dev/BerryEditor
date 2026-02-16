import { createBerryPickrController, type BerryPickrController } from '@appberry/berrypickr'
import { useMountedBerryPickrUI } from '@appberry/berrypickr/react'
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import type { ColorPickerRenderProps } from './types'

type DefaultBerryPickrColorPickerProps = Pick<
  ColorPickerRenderProps,
  'value' | 'disabled' | 'swatches' | 'onCommit' | 'onClear' | 'onClose'
>

/**
 * Built-in inline color picker powered by `@appberry/berrypickr`.
 */
export function DefaultBerryPickrColorPicker({
  value,
  disabled,
  swatches,
  onCommit,
  onClear,
  onClose
}: DefaultBerryPickrColorPickerProps): ReactElement {
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const [draftHex, setDraftHex] = useState(value)
  const controllerRef = useRef<BerryPickrController | null>(null)
  if (!controllerRef.current) {
    controllerRef.current = createBerryPickrController({
      format: 'hex',
      formats: ['hex'],
      lockAlpha: true,
      disabled,
      swatches,
      value
    })
  }
  const controller = controllerRef.current

  useMountedBerryPickrUI(controller, anchorRef, {
    uiOptions: {
      mode: 'inline',
      showAlways: true,
      components: {
        alpha: false,
        save: false,
        cancel: false,
        clear: false
      }
    },
    removeOnUnmount: true
  })

  useEffect(() => {
    // React Strict Mode runs effect cleanup/re-run on mount in dev.
    // Keep one controller instance alive for this mounted picker.
    controller.updateOptions({
      format: 'hex',
      formats: ['hex'],
      lockAlpha: true,
      disabled,
      swatches
    })
    controller.setValue(value, { source: 'options' })
    setDraftHex(value)
  }, [controller, disabled, swatches, value])

  useEffect(() => {
    return controller.on('change', (event) => {
      const hex = event.value?.to('hex')
      if (!hex) return
      setDraftHex(hex)
    })
  }, [controller])

  const applyColor = useCallback(() => {
    const hex = controller.getState().value?.to('hex') ?? draftHex
    if (!hex) return
    onCommit(hex)
  }, [controller, draftHex, onCommit])

  return (
    <div className={`berry-toolbar__color-picker-host${disabled ? ' is-disabled' : ''}`}>
      <div ref={anchorRef} className="berry-toolbar__color-picker-anchor" />
      <div className="berry-toolbar__color-picker-actions">
        <button
          type="button"
          onMouseDown={(event) => {
            event.preventDefault()
          }}
          onClick={applyColor}
          disabled={disabled}
        >
          Apply
        </button>
        {onClear ? (
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault()
            }}
            onClick={onClear}
            disabled={disabled}
          >
            Clear highlight
          </button>
        ) : null}
        <button
          type="button"
          onMouseDown={(event) => {
            event.preventDefault()
          }}
          onClick={onClose}
          disabled={disabled}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
