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

  it('puts the start first, without narrowing the title as the leading content does', () => {
    renderDs(
      <>
        <RowLine
          start={<span>Icon</span>}
          primary={<span data-testid="after-start">Subject</span>}
          data-testid="line"
        />
        <RowLine
          leading={<span>Chip</span>}
          primary={<span data-testid="after-leading">Subject</span>}
        />
      </>
    )

    expect(screen.getByTestId('line')).toHaveTextContent('IconSubject')
    expect(screen.getByTestId('after-start').parentElement).toHaveStyle({
      maxWidth: '50%'
    })
    expect(screen.getByTestId('after-leading').parentElement).toHaveStyle({
      maxWidth: '40%'
    })
  })

  it('has no preview slot without a preview', () => {
    renderDs(<RowLine primary="Subject" data-testid="line" />)

    expect(screen.getByTestId('line').children).toHaveLength(1)
  })

  it('writes the title in Semi Bold and the preview in the main colour when strong', () => {
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
      fontWeight: '600'
    })
  })
})
