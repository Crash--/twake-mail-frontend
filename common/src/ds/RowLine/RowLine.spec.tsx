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

  it('has no preview slot without a preview', () => {
    renderDs(<RowLine primary="Subject" data-testid="line" />)

    expect(screen.getByTestId('line').children).toHaveLength(1)
  })
})
