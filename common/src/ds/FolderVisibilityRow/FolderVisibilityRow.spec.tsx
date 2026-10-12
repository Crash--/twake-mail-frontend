import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { FolderOutlined } from '@/ds/FlutterIcons/FlutterIcons'
import { renderDs } from '@/ds/testing/renderDs'

import { FolderVisibilityRow } from './FolderVisibilityRow'

describe('FolderVisibilityRow', () => {
  it('shows its name, second line and action, and its subfolders once expanded', async () => {
    const onToggle = jest.fn()
    const { rerender } = renderDs(
      <ul>
        <FolderVisibilityRow
          name="Projects"
          icon={FolderOutlined}
          secondary="projects@example.com"
          expand={{
            isExpanded: false,
            label: 'Expand',
            onToggle,
            controlsId: 'sub'
          }}
          action={<button type="button">Hide</button>}
          data-testid="row"
          dataAttributes={{ 'data-hidden': 'true' }}
        >
          <li>Alpha</li>
        </FolderVisibilityRow>
      </ul>
    )

    expect(screen.getByTestId('row')).toHaveAttribute('data-hidden', 'true')
    expect(screen.getByText('projects@example.com')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Hide' })).toBeVisible()
    expect(screen.queryByText('Alpha')).toBe(null)
    const expand = screen.getByRole('button', { name: 'Expand' })
    expect(expand).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(expand)
    expect(onToggle).toHaveBeenCalledTimes(1)

    rerender(
      <ul>
        <FolderVisibilityRow
          name="Projects"
          expand={{
            isExpanded: true,
            label: 'Collapse',
            onToggle,
            controlsId: 'sub'
          }}
        >
          <li>Alpha</li>
        </FolderVisibilityRow>
      </ul>
    )
    expect(screen.getByText('Alpha')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Collapse' })).toHaveAttribute(
      'aria-controls',
      'sub'
    )
  })
})
