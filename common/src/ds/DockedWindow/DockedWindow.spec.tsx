import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import { DockedWindow, type DockedWindowMode } from './DockedWindow'
import { WindowDock } from './WindowDock'

const LABELS = {
  minimize: 'Minimize',
  restore: 'Show',
  fullscreen: 'Fullscreen',
  exitFullscreen: 'Exit fullscreen',
  close: 'Close'
}

function Harness({
  viewTransitionName,
  isModal = false,
  isCompact = false,
  isTitleBarHidden = false,
  isTitleCentered = false,
  onEscape = jest.fn(),
  onClose = jest.fn()
}: {
  viewTransitionName?: string
  isModal?: boolean
  isCompact?: boolean
  isTitleBarHidden?: boolean
  isTitleCentered?: boolean
  onEscape?: () => void
  onClose?: () => void
}): ReactElement {
  const [mode, setMode] = useState<DockedWindowMode>('normal')
  return (
    <WindowDock>
      <DockedWindow
        title="New message"
        mode={mode}
        isModal={isModal}
        isCompact={isCompact}
        isTitleBarHidden={isTitleBarHidden}
        isTitleCentered={isTitleCentered}
        labels={LABELS}
        onModeChange={setMode}
        onClose={onClose}
        onEscape={onEscape}
        viewTransitionName={viewTransitionName}
        testIds={{ window: 'window' }}
      >
        <label>
          Subject
          <input />
        </label>
      </DockedWindow>
    </WindowDock>
  )
}

function viewTransitionName(element: HTMLElement): string {
  return getComputedStyle(element).getPropertyValue('view-transition-name')
}

describe('DockedWindow', () => {
  it('is a layer of its own in a view transition of the page when it has a name', () => {
    renderDs(<Harness viewTransitionName="composer-1" isModal />)

    expect(viewTransitionName(screen.getByRole('dialog'))).toBe('composer-1')
  })

  it('is part of the page in a view transition without a name', () => {
    renderDs(<Harness isModal />)

    expect(viewTransitionName(screen.getByRole('dialog'))).toBe('')
  })

  it('is a non modal dialog named by its title', () => {
    renderDs(<Harness />)
    const dialog = screen.getByRole('dialog', { name: 'New message' })

    expect(dialog).not.toHaveAttribute('aria-modal')
    expect(screen.getByRole('heading', { name: 'New message' })).toBeVisible()
  })

  it('keeps its content while minimized, and gives the focus back', async () => {
    renderDs(<Harness />)
    const subject = screen.getByRole('textbox', { name: 'Subject' })
    await userEvent.type(subject, 'Hello')

    await userEvent.click(screen.getByRole('button', { name: 'Minimize' }))
    const restore = screen.getByRole('button', { name: 'Show: New message' })
    expect(restore).toHaveFocus()
    expect(screen.queryByRole('textbox', { name: 'Subject' })).toBe(null)
    expect(screen.getByTestId('window')).toHaveAttribute(
      'data-mode',
      'minimized'
    )

    await userEvent.click(restore)
    expect(screen.getByRole('textbox', { name: 'Subject' })).toHaveValue(
      'Hello'
    )
    expect(screen.getByRole('textbox', { name: 'Subject' })).toHaveFocus()
  })

  it('goes full screen as a modal dialog, and back', async () => {
    renderDs(<Harness />)
    const subject = screen.getByRole('textbox', { name: 'Subject' })
    await userEvent.type(subject, 'Hello')

    await userEvent.click(screen.getByRole('button', { name: 'Fullscreen' }))
    const dialog = screen.getByRole('dialog', { name: 'New message' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('textbox', { name: 'Subject' })).toHaveValue(
      'Hello'
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Exit fullscreen' })
    )
    expect(dialog).not.toHaveAttribute('aria-modal')
  })

  it('hands Escape and the close button to its owner', async () => {
    const onEscape = jest.fn()
    const onClose = jest.fn()
    renderDs(<Harness onEscape={onEscape} onClose={onClose} />)

    await userEvent.click(screen.getByRole('textbox', { name: 'Subject' }))
    await userEvent.keyboard('{Escape}')
    expect(onEscape).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('fills a small screen, without minimize nor full screen buttons', () => {
    renderDs(<Harness isModal isCompact />)

    expect(screen.getByRole('dialog', { name: 'New message' })).toHaveAttribute(
      'aria-modal',
      'true'
    )
    expect(screen.queryByRole('button', { name: 'Minimize' })).toBe(null)
    expect(screen.queryByRole('button', { name: 'Fullscreen' })).toBe(null)
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('leaves the top of a phone to its content, the title staying the name of the dialog', () => {
    renderDs(<Harness isModal isCompact isTitleBarHidden />)

    expect(screen.getByRole('dialog', { name: 'New message' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Close' })).toBe(null)
    expect(screen.getByRole('heading', { name: 'New message' })).toHaveClass(
      'u-visuallyhidden'
    )
  })

  it('centres the title of a tablet and keeps the three buttons', () => {
    renderDs(<Harness isTitleCentered />)

    const bar = screen
      .getByRole('heading', { name: 'New message' })
      .closest('div')
    if (bar === null) throw new Error('No title bar')
    expect(getComputedStyle(bar).gridTemplateColumns).toBe('1fr auto 1fr')
    for (const name of ['Minimize', 'Fullscreen', 'Close']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })
})
