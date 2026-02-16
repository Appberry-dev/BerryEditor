import type { PointerEvent, ReactElement } from 'react'
import type { EditorCommand } from '../core/commands'

type TableBubbleCommand = Extract<
  EditorCommand,
  | 'tableAddRowAbove'
  | 'tableAddRowBelow'
  | 'tableDeleteRow'
  | 'tableAddColumnLeft'
  | 'tableAddColumnRight'
  | 'tableDeleteColumn'
  | 'tableDelete'
>

interface TableAction {
  command: TableBubbleCommand
  icon: string
  label: string
  destructive?: boolean
}

interface TableContextBubbleProps {
  visible: boolean
  left: number
  top: number
  disabled: boolean
  onCommand: (command: TableBubbleCommand) => void
}

const ROW_ACTIONS: TableAction[] = [
  { command: 'tableAddRowAbove', icon: 'north', label: 'Add row above' },
  { command: 'tableAddRowBelow', icon: 'south', label: 'Add row below' },
  { command: 'tableDeleteRow', icon: 'horizontal_rule', label: 'Delete row', destructive: true }
]

const COLUMN_ACTIONS: TableAction[] = [
  { command: 'tableAddColumnLeft', icon: 'west', label: 'Add column left' },
  { command: 'tableAddColumnRight', icon: 'east', label: 'Add column right' },
  {
    command: 'tableDeleteColumn',
    icon: 'vertical_align_center',
    label: 'Delete column',
    destructive: true
  }
]

const TABLE_ACTIONS: TableAction[] = [
  { command: 'tableDelete', icon: 'delete_forever', label: 'Delete table', destructive: true }
]

function preventFocusShift(event: PointerEvent<HTMLButtonElement>): void {
  event.preventDefault()
}

function renderAction(
  action: TableAction,
  props: Pick<TableContextBubbleProps, 'disabled' | 'onCommand'>
): ReactElement {
  const className = `berry-table-bubble__chip${action.destructive ? ' berry-table-bubble__chip--danger' : ''}`
  return (
    <button
      key={action.command}
      type="button"
      className={className}
      disabled={props.disabled}
      aria-label={action.label}
      title={action.label}
      onMouseDown={(event) => event.preventDefault()}
      onPointerDown={preventFocusShift}
      onClick={() => props.onCommand(action.command)}
    >
      <span className="berry-toolbar__material-icon" aria-hidden="true">
        {action.icon}
      </span>
    </button>
  )
}

export function TableContextBubble({
  visible,
  left,
  top,
  disabled,
  onCommand
}: TableContextBubbleProps): ReactElement | null {
  if (!visible) return null

  return (
    <div
      className="berry-table-bubble"
      style={{ left, top }}
      role="toolbar"
      aria-label="Table editing tools"
    >
      <div className="berry-table-bubble__group">
        {ROW_ACTIONS.map((action) => renderAction(action, { disabled, onCommand }))}
      </div>
      <div className="berry-table-bubble__group">
        {COLUMN_ACTIONS.map((action) => renderAction(action, { disabled, onCommand }))}
      </div>
      <div className="berry-table-bubble__group">
        {TABLE_ACTIONS.map((action) => renderAction(action, { disabled, onCommand }))}
      </div>
    </div>
  )
}
