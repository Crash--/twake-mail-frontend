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

  it('keeps the main pane flush, without rounded corners', () => {
    renderDs(
      <Layout withTopBar={false}>
        <FlatMain data-testid="main">
          <FlatContent>Body</FlatContent>
        </FlatMain>
      </Layout>
    )

    expect(screen.getByTestId('main')).not.toHaveStyle({
      borderRadius: '16px'
    })
  })

  it('keeps the sx of the panes out of the DOM', () => {
    renderDs(
      <Layout withTopBar={false}>
        <FlatMain data-testid="main">
          <FlatContent data-testid="content">Body</FlatContent>
        </FlatMain>
      </Layout>
    )

    expect(screen.getByTestId('main').getAttribute('sx')).toBe(null)
    expect(screen.getByTestId('content').getAttribute('sx')).toBe(null)
  })
})
