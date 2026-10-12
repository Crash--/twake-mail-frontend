import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Send } from '@/ds/FlutterIcons/FlutterIcons'
import { renderDs } from '@/ds/testing/renderDs'

import { AiScribeBar } from './AiScribeBar'

describe('AiScribeBar', () => {
  it('sends the prompt on Enter, Shift+Enter starting a new line, the button waiting for text', async () => {
    const onSubmit = jest.fn()
    renderDs(
      <AiScribeBar
        label="Help me write"
        sendLabel="Send"
        sendIcon={Send}
        onSubmit={onSubmit}
      />
    )

    const field = screen.getByRole('textbox', { name: 'Help me write' })
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await userEvent.type(field, 'Thank Bob{Shift>}{Enter}{/Shift}  ')
    expect(onSubmit).not.toHaveBeenCalled()
    await userEvent.type(field, '{Enter}')

    expect(onSubmit).toHaveBeenCalledWith('Thank Bob')
    expect(field).toHaveValue('')
  })
})
