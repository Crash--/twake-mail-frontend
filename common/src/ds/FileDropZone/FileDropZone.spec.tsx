import { fireEvent, screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { FileDropZone, ignoreFileDropsOnPage } from './FileDropZone'

/** What the zone reads of a drag: its types and its files */
function transfer(files: File[]): { types: string[]; files: File[] } {
  return { types: ['Files'], files }
}

describe('FileDropZone', () => {
  it('shows its label while files are dragged over, and takes the dropped files', () => {
    const onFiles = jest.fn()
    renderDs(
      <FileDropZone
        label="Drop file here to attach them"
        onFiles={onFiles}
        data-testid="zone"
      >
        <p>Content</p>
      </FileDropZone>
    )
    const zone = screen.getByTestId('zone')
    const file = new File(['x'], 'report.pdf', { type: 'application/pdf' })

    fireEvent.dragEnter(zone, { dataTransfer: transfer([file]) })
    expect(
      screen.getByText('Drop file here to attach them')
    ).toBeInTheDocument()

    fireEvent.drop(zone, { dataTransfer: transfer([file]) })
    expect(onFiles).toHaveBeenCalledWith([file])
    expect(screen.queryByText('Drop file here to attach them')).toBe(null)
  })

  it('takes the data of its type dragged inside the app', () => {
    const onFiles = jest.fn()
    const onData = jest.fn()
    renderDs(
      <FileDropZone
        label="Drop file here"
        onFiles={onFiles}
        dataType="application/x-thing"
        onData={onData}
        data-testid="zone"
      >
        <p>Content</p>
      </FileDropZone>
    )
    const zone = screen.getByTestId('zone')
    const dataTransfer = {
      types: ['application/x-thing'],
      files: [],
      getData: (type: string): string =>
        type === 'application/x-thing' ? 'value' : ''
    }

    fireEvent.dragEnter(zone, { dataTransfer })
    expect(screen.getByText('Drop file here')).toBeInTheDocument()
    fireEvent.drop(zone, { dataTransfer })

    expect(onData).toHaveBeenCalledWith('value')
    expect(onFiles).not.toHaveBeenCalled()
    expect(screen.queryByText('Drop file here')).toBe(null)
  })

  it('leaves dragged text alone', () => {
    const onFiles = jest.fn()
    renderDs(
      <FileDropZone label="Drop file here" onFiles={onFiles} data-testid="zone">
        <p>Content</p>
      </FileDropZone>
    )

    fireEvent.dragEnter(screen.getByTestId('zone'), {
      dataTransfer: { types: ['text/plain'], files: [] }
    })
    expect(screen.queryByText('Drop file here')).toBe(null)
  })

  it('leaves to its child the drags it says are for it', () => {
    const onFiles = jest.fn()
    const onChildDrop = jest.fn()
    renderDs(
      <FileDropZone
        label="Drop file here"
        onFiles={onFiles}
        isForChild={event =>
          event.target instanceof Element &&
          event.target.closest('[data-child]') !== null
        }
        data-testid="zone"
      >
        <p data-child="" onDrop={onChildDrop}>
          Editor
        </p>
      </FileDropZone>
    )
    const file = new File(['x'], 'photo.png', { type: 'image/png' })

    fireEvent.dragOver(screen.getByText('Editor'), {
      dataTransfer: transfer([file])
    })
    expect(screen.queryByText('Drop file here')).toBe(null)
    fireEvent.drop(screen.getByText('Editor'), {
      dataTransfer: transfer([file])
    })
    expect(onFiles).not.toHaveBeenCalled()
    expect(onChildDrop).toHaveBeenCalled()
  })
})

describe('ignoreFileDropsOnPage (tf#2600)', () => {
  it('keeps the browser from opening a file dropped out of every zone', () => {
    const onFiles = jest.fn()
    renderDs(
      <>
        <p>The list</p>
        <FileDropZone
          label="Drop file here"
          onFiles={onFiles}
          data-testid="zone"
        >
          <p>Content</p>
        </FileDropZone>
      </>
    )
    const removeListeners = ignoreFileDropsOnPage(window)
    const file = new File(['x'], 'report.pdf', { type: 'application/pdf' })

    expect(
      fireEvent.dragOver(screen.getByText('The list'), {
        dataTransfer: transfer([file])
      })
    ).toBe(false)
    expect(
      fireEvent.drop(screen.getByText('The list'), {
        dataTransfer: transfer([file])
      })
    ).toBe(false)
    // Dragged text keeps what the browser does with it
    expect(
      fireEvent.drop(screen.getByText('The list'), {
        dataTransfer: { types: ['text/plain'], files: [] }
      })
    ).toBe(true)
    // The zone still takes its files
    fireEvent.drop(screen.getByTestId('zone'), {
      dataTransfer: transfer([file])
    })
    expect(onFiles).toHaveBeenCalledWith([file])
    removeListeners()
  })
})
