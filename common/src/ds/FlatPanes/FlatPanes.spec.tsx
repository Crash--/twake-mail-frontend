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
})
