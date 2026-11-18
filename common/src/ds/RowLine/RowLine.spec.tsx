import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { RowLine } from './RowLine'

describe('RowLine', () => {
  it('puts the leading content, the title, the preview and the trailing content in order', () => {
    renderDs(
      <RowLine
        leading={<span>Chip</span>}
        primary="Subject"
        secondary="Preview"
        trailing={<span>Folder</span>}
        data-testid="line"
      />
    )

    expect(screen.getByTestId('line')).toHaveTextContent(
      'ChipSubjectPreviewFolder'
    )
  })

  it('caps the title at 55 % of its room with the preview, whatever comes before', () => {
    renderDs(
      <>
        <RowLine
          start={<span>Icon</span>}
          leading={<span>Chip</span>}
          primary={<span data-testid="after-leading">Subject</span>}
          secondary="Preview"
          data-testid="line"
        />
        <RowLine
          primary={<span data-testid="plain">Subject</span>}
          secondary="Preview"
        />
      </>
    )

    expect(screen.getByTestId('line')).toHaveTextContent(
      'IconChipSubjectPreview'
    )
    for (const id of ['after-leading', 'plain']) {
      expect(screen.getByTestId(id).parentElement).toHaveStyle({
        maxWidth: '55%'
      })
    }
  })

  it('lets the title take the whole room without a preview', () => {
    renderDs(
      <RowLine
        primary={<span data-testid="title">Subject</span>}
        secondary={null}
        data-testid="line"
      />
    )

    expect(screen.getByTestId('title').parentElement).toHaveStyle({
      maxWidth: '100%'
    })
    expect(screen.getByTestId('title').parentElement?.nextSibling).toBe(null)
  })

  it('writes the title in Semi Bold and the preview in Medium when strong', () => {
    renderDs(
      <RowLine
        primary={<span data-testid="title">Subject</span>}
        secondary={<span data-testid="preview">Preview</span>}
        isStrong
        data-testid="line"
      />
    )

    expect(screen.getByTestId('title').parentElement).toHaveStyle({
      fontWeight: '600'
    })
    expect(screen.getByTestId('preview').parentElement).toHaveStyle({
      fontWeight: '500'
    })
  })
})
