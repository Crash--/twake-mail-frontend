import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { InlineAlert } from './InlineAlert'

describe('InlineAlert', () => {
  it('is a note saying its level before its sentence', () => {
    renderDs(
      <InlineAlert level="warn" levelLabel="Warning" data-testid="inline">
        Attachment blocked.
      </InlineAlert>
    )

    expect(screen.getByRole('note')).toHaveTextContent(
      'Warning: Attachment blocked.'
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
