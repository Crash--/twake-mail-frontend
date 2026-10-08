import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AiChangeTone, AiGrammar } from '@/ds/FlutterIcons/FlutterIcons'
import { renderDs } from '@/ds/testing/renderDs'

import { AiScribeMenu } from './AiScribeMenu'

const CATEGORIES = [
  {
    id: 'correct',
    label: 'Correct',
    icon: AiGrammar,
    actions: [{ id: 'correct-grammar', label: 'Correct' }]
  },
  {
    id: 'tone',
    label: 'Change tone',
    icon: AiChangeTone,
    actions: [
      { id: 'casual', label: 'More casual' },
      { id: 'polite', label: 'More polite' }
    ]
  }
]

describe('AiScribeMenu', () => {
  it('runs the only action of a category, opens the others beside, and comes back with Left', async () => {
    const onSelect = jest.fn()
    renderDs(
      <AiScribeMenu
        label="AI assistant"
        categories={CATEGORIES}
        onSelect={onSelect}
      />
    )

    await userEvent.click(screen.getByRole('menuitem', { name: 'Correct' }))
    expect(onSelect).toHaveBeenCalledWith('correct-grammar')

    const tone = screen.getByRole('menuitem', { name: 'Change tone' })
    tone.focus()
    await userEvent.keyboard('{ArrowRight}')
    const submenu = screen.getByRole('menu', { name: 'Change tone' })
    await waitFor(() => {
      expect(
        within(submenu).getByRole('menuitem', { name: 'More casual' })
      ).toHaveFocus()
    })
    await userEvent.keyboard('{ArrowDown}')
    expect(
      within(submenu).getByRole('menuitem', { name: 'More polite' })
    ).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenLastCalledWith('polite')

    await userEvent.keyboard('{ArrowLeft}')
    expect(tone).toHaveFocus()
    expect(screen.queryByRole('menu', { name: 'Change tone' })).toBe(null)
  })
})
