// Upstream to twake-ui: yes, as a `link` variant of `Button`. twake-mui's
// text button is 16 px, has no underline and its colour is the primary one;
// the fields of the Figma composer show "From", "CC", "BCC" as small
// underlined actions in the secondary colour (docs/twake-mui-gaps.md).
import { Button } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

export interface FieldTextButtonProps {
  children: ReactNode
  onClick: () => void
  'data-testid'?: string
}

/**
 * An underlined text button at the end of a field line: Inter Medium 14 /
 * 18.4, secondary text colour, 2 px by 4 px of padding, pill radius.
 */
export function FieldTextButton({
  children,
  onClick,
  'data-testid': testId
}: FieldTextButtonProps): ReactElement {
  return (
    <Button
      variant="text"
      color="inherit"
      onClick={onClick}
      data-testid={testId}
      sx={{
        minWidth: 0,
        minHeight: 0,
        py: '2px',
        px: '4px',
        borderRadius: '100px',
        color: 'text.secondary',
        fontSize: 14,
        fontWeight: 500,
        lineHeight: '18.4px',
        letterSpacing: '0.25px',
        textTransform: 'none',
        textDecoration: 'underline',
        '&:hover': { textDecoration: 'underline' }
      }}
    >
      {children}
    </Button>
  )
}
