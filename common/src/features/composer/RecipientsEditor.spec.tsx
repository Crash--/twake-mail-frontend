import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useState, type ReactElement } from 'react'

import { makeEmail, makeFakeJmapServer } from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'
import { DRAGGED_EMAILS_TYPE } from '@common/features/thread/useEmailListActions'

import {
  RecipientsEditor,
  type RecipientKind,
  type RecipientLists
} from './RecipientsEditor'

/** What the browser hands to the drag events, shared by one drag */
function makeDataTransfer(): DataTransfer {
  const data = new Map<string, string>()
  const transfer = {
    dropEffect: 'none',
    effectAllowed: 'all',
    get types() {
      return [...data.keys()]
    },
    setData: (type: string, value: string) => {
      data.set(type, value)
    },
    getData: (type: string) => data.get(type) ?? '',
    setDragImage: jest.fn()
  }
  // Only what the fields read of it
  return transfer as Partial<DataTransfer> as DataTransfer
}

function Harness(): ReactElement {
  const [recipients, setRecipients] = useState<RecipientLists>({
    to: [
      { name: 'Alice Martin', email: 'alice@example.com' },
      { name: null, email: 'dan@example.com' }
    ],
    cc: [],
    bcc: [],
    replyTo: []
  })
  const [inputs, setInputs] = useState({ to: '', cc: '', bcc: '', replyTo: '' })
  return (
    <RecipientsEditor
      recipients={recipients}
      onChange={(kind, list) => {
        setRecipients(current => ({ ...current, [kind]: list }))
      }}
      inputs={inputs}
      onInputChange={(kind, value) => {
        setInputs(current => ({ ...current, [kind]: value }))
      }}
      shown={new Set<RecipientKind>(['cc'])}
      onShow={jest.fn()}
      onHide={jest.fn()}
      fromLine={null}
      onShowFrom={null}
      isCollapsed={false}
      onExpand={jest.fn()}
    />
  )
}

function chipsIn(field: string): string[] {
  return within(screen.getByTestId(`composer-${field}-field`))
    .queryAllByTestId('recipient-chip')
    .map(chip => chip.getAttribute('aria-label') ?? '')
}

async function renderEditor(): Promise<void> {
  renderWithProviders(<Harness />, {
    withJmapSession: true,
    jmapServer: makeFakeJmapServer({
      emails: [
        makeEmail({ id: 'e1' }),
        makeEmail({
          id: 'e2',
          from: [{ name: 'Carol', email: 'carol@example.com' }]
        }),
        makeEmail({
          id: 'e3',
          from: [{ name: null, email: 'ALICE@example.com' }]
        })
      ]
    })
  })
  await screen.findByTestId('composer-to-field')
}

describe('RecipientsEditor', () => {
  it('moves a recipient dragged to Cc, as tmail-flutter', async () => {
    await renderEditor()
    const alice = within(
      screen.getByTestId('composer-to-field')
    ).getAllByTestId('recipient-chip')[0]
    if (!alice) throw new Error('No tag')
    const cc = screen.getByTestId('composer-cc-field')
    const dataTransfer = makeDataTransfer()

    fireEvent.dragStart(alice, { dataTransfer })
    fireEvent.dragEnter(cc, { dataTransfer })
    fireEvent.dragOver(cc, { dataTransfer })
    fireEvent.drop(cc, { dataTransfer })
    fireEvent.dragEnd(alice, { dataTransfer })

    expect(chipsIn('to')).toEqual(['dan@example.com'])
    expect(chipsIn('cc')).toEqual(['Alice Martin'])
  })

  it('adds the senders of the emails dropped on a field, once each', async () => {
    await renderEditor()
    const to = screen.getByTestId('composer-to-field')
    const dataTransfer = makeDataTransfer()
    dataTransfer.setData(
      DRAGGED_EMAILS_TYPE,
      JSON.stringify({
        mailboxId: 'mailbox-inbox',
        emailIds: ['e1', 'e2', 'e3']
      })
    )

    fireEvent.dragEnter(to, { dataTransfer })
    fireEvent.dragOver(to, { dataTransfer })
    fireEvent.drop(to, { dataTransfer })

    await waitFor(() => {
      expect(chipsIn('to')).toEqual([
        'Alice Martin',
        'dan@example.com',
        'Bob Dupont',
        'Carol'
      ])
    })
    expect(chipsIn('cc')).toEqual([])
  })
})
