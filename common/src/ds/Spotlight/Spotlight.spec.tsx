import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useRef, useState, type ReactElement } from 'react'

import { SearchCombobox } from '@/ds/SearchCombobox/SearchCombobox'
import { renderDs } from '@/ds/testing/renderDs'

import { Spotlight } from './Spotlight'

const onSelect = jest.fn()
const onSubmit = jest.fn()
const onOpenChange = jest.fn()

// A page a choice opens: it focuses its heading when the focus is nowhere,
// as the app does after a navigation
function Page({ name }: { name: string }): ReactElement {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (document.activeElement === document.body) heading.current?.focus()
  }, [])
  return (
    <h1 ref={heading} tabIndex={-1}>
      {name}
    </h1>
  )
}

function Harness(): ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const [value, setValue] = useState('')
  const [page, setPage] = useState<string | null>(null)
  return (
    <>
      {page === null ? null : <Page name={page} />}
      <button
        type="button"
        onClick={() => {
          setIsOpen(true)
        }}
      >
        Open
      </button>
      {isOpen ? (
        <Spotlight
          title="SpotMail"
          hints={[{ keys: 'Esc', label: 'Close' }]}
          onClose={() => {
            setIsOpen(false)
          }}
        >
          <SearchCombobox
            inline
            value={value}
            onChange={setValue}
            onSubmit={onSubmit}
            onSelect={option => {
              onSelect(option)
              setIsOpen(false)
              setPage(option.id)
            }}
            onOpenChange={onOpenChange}
            groups={[
              {
                id: 'folders',
                label: 'Folders',
                options: [
                  { id: 'inbox', label: 'Inbox' },
                  { id: 'sent', label: 'Sent' }
                ]
              }
            ]}
            label="Search emails"
            listLabel="Suggestions"
            clearLabel="Clear"
          />
        </Spotlight>
      ) : null}
    </>
  )
}

describe('Spotlight', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('is a named dialog showing the suggestions at once, the focus in its field', async () => {
    renderDs(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))

    const dialog = screen.getByRole('dialog', { name: 'SpotMail' })
    const field = within(dialog).getByRole('combobox', {
      name: 'Search emails'
    })
    await waitFor(() => {
      expect(field).toHaveFocus()
    })
    expect(
      within(dialog).getByRole('option', { name: 'Inbox' })
    ).toBeInTheDocument()
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
  })

  it('picks the option the arrows reach, and submits the text without one', async () => {
    renderDs(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    const field = screen.getByRole('combobox', { name: 'Search emails' })
    await waitFor(() => {
      expect(field).toHaveFocus()
    })

    await userEvent.keyboard('{Enter}')
    expect(onSubmit).toHaveBeenCalledTimes(1)

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sent' })
    )
  })

  it('closes on Escape and gives the focus back to the opener', async () => {
    renderDs(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open' })
    await userEvent.click(opener)
    await waitFor(() => {
      expect(
        screen.getByRole('combobox', { name: 'Search emails' })
      ).toHaveFocus()
    })

    await userEvent.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
    await waitFor(() => {
      expect(opener).toHaveFocus()
    })
  })

  it('leaves the focus to the page a choice opens', async () => {
    renderDs(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    await waitFor(() => {
      expect(
        screen.getByRole('combobox', { name: 'Search emails' })
      ).toHaveFocus()
    })

    await userEvent.keyboard('{ArrowDown}{Enter}')

    const page = await screen.findByRole('heading', { name: 'inbox' })
    // Past the moment the focus would go back to the opener
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(page).toHaveFocus()
  })
})
