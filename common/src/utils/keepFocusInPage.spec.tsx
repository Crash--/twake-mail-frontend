import { waitFor } from '@testing-library/react'

import { focusTargetsAround, keepFocusInPage } from './keepFocusInPage'

function renderList(): HTMLElement {
  document.body.innerHTML = `
    <section>
      <h1 tabindex="-1">Rules</h1>
      <ul>
        <li><a href="#a">A</a><button>Delete A</button></li>
        <li><a href="#b">B</a><button>Delete B</button></li>
        <li><a href="#c">C</a><button>Delete C</button></li>
      </ul>
    </section>
  `
  return document.body
}

function deleteButtonOf(name: string): HTMLElement {
  const button = [...document.querySelectorAll('button')].find(
    element => element.textContent === `Delete ${name}`
  )
  if (button === undefined) throw new Error(`No button for ${name}`)
  return button
}

describe('keepFocusInPage', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('moves the focus to the next row when the focused row leaves', async () => {
    renderList()
    const button = deleteButtonOf('B')
    const targets = focusTargetsAround(button)
    button.focus()

    button.closest('li')?.remove()
    keepFocusInPage(targets)

    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe('C')
    })
  })

  it('moves the focus to the previous row when the last row leaves', async () => {
    renderList()
    const button = deleteButtonOf('C')
    const targets = focusTargetsAround(button)

    keepFocusInPage(targets)
    button.focus()
    button.closest('li')?.remove()

    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe('B')
    })
  })

  it('moves the focus to the heading of the section when the list empties', async () => {
    renderList()
    const targets = focusTargetsAround(deleteButtonOf('A'))

    document.querySelector('ul')?.remove()
    keepFocusInPage(targets)

    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe('Rules')
    })
  })

  it('leaves the focus where it is when it was not lost', async () => {
    renderList()
    const targets = focusTargetsAround(deleteButtonOf('B'))
    const other = deleteButtonOf('A')
    other.focus()

    deleteButtonOf('B').closest('li')?.remove()
    keepFocusInPage(targets)

    await new Promise(resolve => {
      requestAnimationFrame(resolve)
    })
    expect(document.activeElement).toBe(other)
  })
})
