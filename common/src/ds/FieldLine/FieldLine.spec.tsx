import { InputBase } from '@linagora/twake-mui'
import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { FieldLine } from './FieldLine'

describe('FieldLine', () => {
  it('names its control with the label', () => {
    renderDs(
      <FieldLine label="Subject" htmlFor="subject">
        <InputBase id="subject" />
      </FieldLine>
    )
    expect(screen.getByRole('textbox', { name: 'Subject' })).not.toBe(null)
  })

  it('keeps a hidden label for assistive technologies', () => {
    renderDs(
      <FieldLine label="Subject" htmlFor="subject" isLabelHidden>
        <InputBase id="subject" placeholder="Subject" />
      </FieldLine>
    )
    expect(screen.getByLabelText('Subject')).not.toBe(null)
    expect(
      screen.getByText('Subject', { selector: 'label' }).className
    ).toContain('u-visuallyhidden')
  })

  it('shows what comes after the control', () => {
    renderDs(
      <FieldLine label="To" endActions={<button type="button">Cc</button>}>
        <InputBase />
      </FieldLine>
    )
    expect(screen.getByRole('button', { name: 'Cc' })).not.toBe(null)
  })
})
