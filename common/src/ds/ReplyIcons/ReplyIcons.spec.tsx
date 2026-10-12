import { renderDs } from '@/ds/testing/renderDs'

import { ForwardIcon, ReplyAllIcon } from './ReplyIcons'

describe('ReplyIcons', () => {
  it('draws tmail-flutter\'s "Reply all" and "Forward", hidden from assistive technologies', () => {
    const { container } = renderDs(
      <>
        <ReplyAllIcon />
        <ForwardIcon size={16} />
      </>
    )

    const [replyAll, forward] = Array.from(container.querySelectorAll('svg'))
    expect(replyAll).toHaveAttribute('aria-hidden', 'true')
    expect(forward).toHaveAttribute('width', '16')
  })
})
