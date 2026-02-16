import { type PointerEvent, type ReactElement } from 'react'

interface ImageContextBubbleProps {
  visible: boolean
  left: number
  top: number
  disabled: boolean
  isWrapped: boolean
  onToggleWrap: (enabled: boolean) => void
  onDelete: () => void
}

function preventFocusShift(event: PointerEvent<HTMLButtonElement>): void {
  event.preventDefault()
}

export function ImageContextBubble({
  visible,
  left,
  top,
  disabled,
  isWrapped,
  onToggleWrap,
  onDelete
}: ImageContextBubbleProps): ReactElement | null {
  if (!visible) return null

  return (
    <div
      className="berry-image-bubble berry-image-bubble--compact"
      style={{ left, top }}
      role="toolbar"
      aria-label="Image editing tools"
    >
      <div className="berry-image-bubble__group" aria-label="Image layout mode">
        <button
          type="button"
          className={`berry-image-bubble__chip berry-image-bubble__chip--text${!isWrapped ? ' is-active' : ''}`}
          disabled={disabled}
          aria-label="Set image inline"
          title="Set image inline"
          onMouseDown={(event) => event.preventDefault()}
          onPointerDown={preventFocusShift}
          onClick={() => onToggleWrap(false)}
        >
          Inline
        </button>
        <button
          type="button"
          className={`berry-image-bubble__chip berry-image-bubble__chip--text${isWrapped ? ' is-active' : ''}`}
          disabled={disabled}
          aria-label="Set image text wrap"
          title="Set image text wrap"
          onMouseDown={(event) => event.preventDefault()}
          onPointerDown={preventFocusShift}
          onClick={() => onToggleWrap(true)}
        >
          Wrap
        </button>
      </div>
      <div className="berry-image-bubble__group" aria-label="Image actions">
        <button
          type="button"
          className="berry-image-bubble__chip berry-image-bubble__chip--danger"
          disabled={disabled}
          aria-label="Delete image"
          title="Delete image"
          onMouseDown={(event) => event.preventDefault()}
          onPointerDown={preventFocusShift}
          onClick={onDelete}
        >
          <span className="berry-toolbar__material-icon" aria-hidden="true">
            delete
          </span>
        </button>
      </div>
    </div>
  )
}
