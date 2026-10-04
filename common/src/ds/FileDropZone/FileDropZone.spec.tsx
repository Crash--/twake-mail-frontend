import { fireEvent, screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { FileDropZone } from './FileDropZone'

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
})
