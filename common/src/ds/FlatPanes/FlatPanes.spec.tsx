import { screen } from '@testing-library/react'
import { Layout } from '@linagora/twake-mui'

import { renderDs } from '@/ds/testing/renderDs'

import { FlatContent, FlatMain } from './FlatPanes'

describe('FlatPanes', () => {
  it('has a content without margin nor rounded corners', () => {
    renderDs(
      <Layout withTopBar={false}>
        <FlatMain>
          <FlatContent data-testid="content">Body</FlatContent>
        </FlatMain>
      </Layout>
    )

    expect(screen.getByTestId('content')).toHaveStyle({
      margin: '0px',
      borderRadius: '0'
    })
  })

  it('makes the main pane a card with margins when inset', () => {
    renderDs(
      <Layout withTopBar={false}>
        <FlatMain inset data-testid="main">
          <FlatContent>Body</FlatContent>
        </FlatMain>
      </Layout>
    )

    expect(screen.getByTestId('main')).toHaveStyle({
      margin: '16px 16px 16px 0',
      borderRadius: '16px'
    })
  })
})
