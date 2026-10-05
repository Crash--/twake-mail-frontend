import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import {
  EmojiPicker,
  type EmojiEntry,
  type EmojiPickerLabels
} from './EmojiPicker'

const LABELS: EmojiPickerLabels = {
  title: 'Emoji',
  search: 'Search emoji',
  noResults: 'No emoji found',
  loading: 'Loading emoji',
  recent: 'Recent',
  categories: 'Emoji categories',
  groups: {
    people: 'Emoji & People',
    animals: 'Animals & Nature',
    food: 'Food & Drink',
    activities: 'Activities',
    travel: 'Travel & Places',
    objects: 'Objects',
    symbols: 'Symbols',
    flags: 'Flags'
  }
}

const EMOJIS: EmojiEntry[] = [
  {
    char: '😀',
    label: 'grinning face',
    tags: ['smile', 'happy'],
    group: 'people'
  },
  {
    char: '😍',
    label: 'smiling face with heart-eyes',
    tags: ['love'],
    group: 'people'
  },
  { char: '🐻', label: 'bear', tags: ['animal'], group: 'animals' },
  { char: '🍔', label: 'hamburger', tags: ['food'], group: 'food' }
]

function Harness({
  emojis = EMOJIS,
  onPick,
  onClose
}: {
  emojis?: EmojiEntry[] | null
  onPick: (emoji: string) => void
  onClose: () => void
}): ReactElement {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <button
        type="button"
        onClick={event => {
          setAnchor(event.currentTarget)
        }}
      >
        Open
      </button>
      <EmojiPicker
        anchor={anchor}
        emojis={emojis}
        recent={['🐻']}
        labels={LABELS}
        onPick={onPick}
        onClose={() => {
          setAnchor(null)
          onClose()
        }}
      />
    </>
  )
}

async function open(): Promise<HTMLElement> {
  await userEvent.click(screen.getByRole('button', { name: 'Open' }))
  return screen.findByRole('dialog', { name: 'Emoji' })
}

describe('EmojiPicker', () => {
  it('opens on the search field, lists the recent emojis then the categories', async () => {
    renderDs(<Harness onPick={jest.fn()} onClose={jest.fn()} />)
    const dialog = await open()

    expect(
      within(dialog).getByRole('searchbox', { name: 'Search emoji' })
    ).toHaveFocus()
    expect(
      within(dialog).getByRole('heading', { name: 'Recent' })
    ).toBeVisible()
    expect(
      within(dialog).getByRole('heading', { name: 'Emoji & People' })
    ).toBeVisible()
    expect(
      within(dialog).getByRole('button', { name: 'grinning face' })
    ).toBeVisible()
  })

  it('picks an emoji with the mouse or the keyboard', async () => {
    const handlePick = jest.fn()
    renderDs(<Harness onPick={handlePick} onClose={jest.fn()} />)
    await open()

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getAllByRole('button', { name: 'bear' })[0]).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}{Enter}')
    expect(handlePick).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'hamburger' }))
    expect(handlePick).toHaveBeenLastCalledWith('🍔')
  })

  it('searches by name and by tag, and says when nothing matches', async () => {
    renderDs(<Harness onPick={jest.fn()} onClose={jest.fn()} />)
    const dialog = await open()

    await userEvent.keyboard('LOVE')
    expect(
      await within(dialog).findByRole('button', {
        name: 'smiling face with heart-eyes'
      })
    ).toBeVisible()
    expect(within(dialog).queryByRole('button', { name: 'bear' })).toBe(null)

    await userEvent.clear(within(dialog).getByRole('searchbox'))
    await userEvent.keyboard('zzz')
    expect(await within(dialog).findByText('No emoji found')).toBeVisible()
  })

  it('closes with Escape', async () => {
    const handleClose = jest.fn()
    renderDs(<Harness onPick={jest.fn()} onClose={handleClose} />)
    await open()

    await userEvent.keyboard('{Escape}')
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('says it is loading while the data is missing', async () => {
    renderDs(<Harness emojis={null} onPick={jest.fn()} onClose={jest.fn()} />)
    const dialog = await open()

    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Loading emoji'
    )
  })
})
