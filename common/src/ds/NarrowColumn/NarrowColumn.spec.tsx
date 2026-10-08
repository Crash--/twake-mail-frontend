import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { NarrowColumn } from './NarrowColumn'

describe('NarrowColumn', () => {
  it('holds its content', () => {
    renderDs(
      <NarrowColumn>
        <p>Content</p>
      </NarrowColumn>
    )

    expect(screen.getByText('Content')).toBeVisible()
  })
})
