import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BerryToolbar, type BerryToolbarProps } from '../src/react/BerryToolbar'

function createProps(overrides: Partial<BerryToolbarProps> = {}): BerryToolbarProps {
  return {
    disabled: false,
    readOnly: false,
    canUndo: false,
    canRedo: false,
    onCommand: vi.fn(),
    canInsertImage: true,
    canInsertDocument: true,
    onPickImage: () => undefined,
    onPickDocument: () => undefined,
    onInsertEmoji: () => undefined,
    onInsertMacro: async () => undefined,
    fontFamilyOptions: [{ label: 'System UI', value: 'system-ui' }],
    ...overrides
  }
}

describe('BerryToolbar', () => {
  it('renders a non-interactive skeleton when loading is true', () => {
    const onCommand = vi.fn()
    render(<BerryToolbar {...createProps({ onCommand, loading: true })} />)

    expect(document.querySelector('.berry-toolbar--loading')).toBeInTheDocument()
    expect(
      screen.queryByRole('toolbar', { name: 'Editor formatting tools' })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bold' })).not.toBeInTheDocument()
    expect(onCommand).not.toHaveBeenCalled()
  })

  it('renders interactive controls and dispatches commands when loading is false', () => {
    const onCommand = vi.fn()
    render(<BerryToolbar {...createProps({ onCommand })} />)

    expect(screen.getByRole('toolbar', { name: 'Editor formatting tools' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Bold' }))
    expect(onCommand).toHaveBeenCalledWith('bold', undefined)
  })

  it('applies toolbar item visibility filters with hideOnly taking precedence', () => {
    render(
      <BerryToolbar
        {...createProps({
          showHTMLToggle: true,
          toolbarItems: {
            showOnly: ['bold', 'italic', 'htmlToggle'],
            hideOnly: ['italic']
          }
        })}
      />
    )

    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Italic' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch to HTML mode' })).toBeInTheDocument()
  })
})
