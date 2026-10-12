import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  Bottom,
  CloseDialog,
  Copy,
  RetryArrows,
  Sparkle,
  Warning
} from '@/ds/FlutterIcons/FlutterIcons'
import { renderDs } from '@/ds/testing/renderDs'

import {
  AiScribeSuggestion,
  type AiScribeSuggestionProps
} from './AiScribeSuggestion'

const LABELS = {
  close: 'Close',
  generating: 'Generating response',
  failed: 'Failed to generate AI response',
  result: 'Suggestion',
  copy: 'Copy',
  retry: 'Retry',
  improve: 'Improve',
  replace: 'Replace',
  insert: 'Insert'
}
const ICONS = {
  sparkle: Sparkle,
  warning: Warning,
  close: CloseDialog,
  copy: Copy,
  retry: RetryArrows,
  chevron: Bottom
}

function renderSuggestion(props: Partial<AiScribeSuggestionProps>): void {
  const anchor = document.createElement('button')
  document.body.append(anchor)
  renderDs(
    <AiScribeSuggestion
      open
      anchorEl={anchor}
      title="Change tone > More casual"
      state={{ status: 'loading' }}
      labels={LABELS}
      icons={ICONS}
      onClose={jest.fn()}
      onCopy={jest.fn()}
      onRetry={jest.fn()}
      onImprove={jest.fn()}
      onReplace={null}
      onInsert={jest.fn()}
      {...props}
    />
  )
}

describe('AiScribeSuggestion', () => {
  it('is a dialog named by what was asked, saying it is generating', () => {
    renderSuggestion({})

    const dialog = screen.getByRole('dialog', {
      name: 'Change tone > More casual'
    })
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Generating response'
    )
  })

  it('offers the actions of tmail-flutter on the answer', async () => {
    const onInsert = jest.fn()
    const onReplace = jest.fn()
    const onImprove = jest.fn()
    renderSuggestion({
      state: { status: 'done', text: 'Hi!' },
      onInsert,
      onReplace,
      onImprove
    })

    expect(
      screen.getByRole('region', { name: 'Suggestion' })
    ).toHaveTextContent('Hi!')
    expect(screen.getByRole('button', { name: 'Copy' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Improve' }))
    expect(onImprove).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Replace' }))
    expect(onReplace).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Insert' }))
    expect(onInsert).toHaveBeenCalledTimes(1)
  })

  it('says when it failed', () => {
    renderSuggestion({ state: { status: 'failed' } })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Failed to generate AI response'
    )
    expect(screen.queryByRole('button', { name: 'Insert' })).toBe(null)
  })
})
