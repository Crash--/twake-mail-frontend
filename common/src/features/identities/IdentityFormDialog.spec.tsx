import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import type { Editor } from '@tiptap/core'
import userEvent from '@testing-library/user-event'

import {
  makeFakeJmapServer,
  makeIdentity,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { IdentityFormDialog } from './IdentityFormDialog'

const PUBLIC_ASSETS = 'com:linagora:params:jmap:public:assets'
const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgo='
/** The images of the text, not the separators ProseMirror draws */
const IMAGE = 'img[src]:not(.ProseMirror-separator)'

function makeServer(): FakeJmapServer {
  const server = makeFakeJmapServer({
    capabilities: { [PUBLIC_ASSETS]: {} },
    identities: [makeIdentity({ id: 'work', name: 'Alice at work' })]
  })
  let created = 0
  server.handlers.set('PublicAsset/set', args => {
    if (!args.create) return { accountId: 'account', destroyed: args.destroy }
    created += 1
    return {
      accountId: 'account',
      created: {
        image: {
          id: `asset-${created}`,
          publicURI: `https://jmap.example.com/publicAsset/asset-${created}`
        }
      }
    }
  })
  return server
}

function renderDialog(
  server: FakeJmapServer,
  onClose = jest.fn()
): { unmount: () => void } {
  const [identity] = server.identities
  if (!identity) throw new Error('No identity')
  const summary = { ...identity, sortOrder: 0 }
  return renderWithProviders(
    <IdentityFormDialog
      identity={summary}
      identities={[summary]}
      hasSortOrder={false}
      onClose={onClose}
    />,
    { jmapServer: server, withJmapSession: true }
  )
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error('No file input')
  return input
}

function png(name = 'logo.png'): File {
  return new File([new Uint8Array([137, 80, 78, 71])], name, {
    type: 'image/png'
  })
}

describe('IdentityFormDialog signature images', () => {
  it('publishes a picked image and shows it from its public address', async () => {
    const server = makeServer()
    renderDialog(server)
    const editor = await screen.findByTestId('identity-signature-editor')

    await userEvent.upload(fileInput(), png())

    await waitFor(() => {
      expect(editor.querySelector(IMAGE)?.getAttribute('src')).toBe(
        'https://jmap.example.com/publicAsset/asset-1'
      )
    })
    expect(server.callsOf('PublicAsset/set')[0]).toEqual(
      expect.objectContaining({
        create: {
          image: expect.objectContaining({ identityIds: { work: true } })
        }
      })
    )
  })

  it('says what the server says when the images take too much room', async () => {
    const server = makeServer()
    server.handlers.set('PublicAsset/set', () => ({
      accountId: 'account',
      notCreated: {
        image: {
          type: 'overQuota',
          description: 'The images of signatures take 20 MB at most'
        }
      }
    }))
    renderDialog(server)
    const editor = await screen.findByTestId('identity-signature-editor')

    await userEvent.upload(fileInput(), png())

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'The images of signatures take 20 MB at most'
    )
    expect(editor.querySelector(IMAGE)).toBe(null)
  })

  it('destroys the images published when it goes away unsaved', async () => {
    const server = makeServer()
    const { unmount } = renderDialog(server)
    const editor = await screen.findByTestId('identity-signature-editor')
    await userEvent.upload(fileInput(), png())
    await waitFor(() => {
      expect(editor.querySelector(IMAGE)).not.toBe(null)
    })

    // The browser back: the settings go away with the dialog
    unmount()

    await waitFor(() => {
      expect(server.callsOf('PublicAsset/set')).toContainEqual(
        expect.objectContaining({ destroy: ['asset-1'] })
      )
    })
  })

  it('publishes an image pasted inside HTML as a data URL', async () => {
    const server = makeServer()
    renderDialog(server)
    const area = await screen.findByTestId('identity-signature-editor')
    const view = (area as HTMLElement & { editor?: Editor }).editor?.view
    if (!view) throw new Error('No editor view')

    act(() => {
      // jsdom has no ClipboardEvent
      view.pasteHTML(
        `<p>Logo <img src="${PNG_DATA_URL}" alt="Logo"></p>`,
        new Event('paste') as ClipboardEvent
      )
    })

    await waitFor(() => {
      expect(area.querySelector(IMAGE)?.getAttribute('src')).toBe(
        'https://jmap.example.com/publicAsset/asset-1'
      )
    })
  })

  it('refuses a dropped file that is not an image', async () => {
    renderDialog(makeServer())
    const zone = await screen.findByTestId('identity-signature-drop-zone')
    const file = new File(['text'], 'notes.txt', { type: 'text/plain' })

    fireEvent.drop(zone, {
      dataTransfer: { types: ['Files'], files: [file] }
    })

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'Can not upload this file to signature'
    )
  })
})
