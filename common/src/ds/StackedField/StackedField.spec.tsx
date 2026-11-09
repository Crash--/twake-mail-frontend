import { TextField } from '@linagora/twake-mui'
import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { StackedField } from './StackedField'

describe('StackedField', () => {
  it('names its field by the label above it', () => {
    renderDs(
      <StackedField label="Folder name" htmlFor="name">
        <TextField id="name" />
      </StackedField>
    )

    expect(
      screen.getByRole('textbox', { name: 'Folder name' })
    ).toHaveAttribute('id', 'name')
  })
})
