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

  it('has a single main landmark, the main pane', () => {
    renderDs(
      <Layout withTopBar={false}>
        <FlatMain data-testid="main">
          <FlatContent>Body</FlatContent>
        </FlatMain>
      </Layout>
    )

    expect(screen.getByRole('main')).toBe(screen.getByTestId('main'))
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

  it('puts a header above the card, inside the main landmark', () => {
    renderDs(
      <Layout withTopBar={false}>
        <FlatMain inset header={<p>Filters</p>} data-testid="main">
          <FlatContent>Body</FlatContent>
        </FlatMain>
      </Layout>
    )

    const main = screen.getByRole('main')
    expect(main).toHaveTextContent('FiltersBody')
    expect(main).toHaveStyle({ margin: '0 16px 16px 0' })
  })
})
