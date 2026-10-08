// Upstream to twake-ui: yes. A quick switcher opened from anywhere (Ctrl+K),
// as Spotlight on a Mac: a large dialog high on the screen, a search with its
// suggestions inline, and the keys at the bottom. Twake Chat and Twake Space
// have one each; twake-mui has no such dialog.
import { Box, Dialog, Typography } from '@linagora/twake-mui'
import {
  useEffect,
  useId,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

const PAPER_SX = {
  // The same height whatever the number of results: the field never jumps
  height: 'min(70vh, 640px)',
  alignSelf: 'flex-start',
  mt: '12vh',
  borderRadius: '16px',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column'
} as const
const BODY_SX = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  px: 2
} as const
const HINTS_SX = {
  display: 'flex',
  gap: 2,
  px: 2.5,
  py: 1,
  borderTop: 1,
  borderColor: 'divider',
  bgcolor: 'background.default'
} as const
const HINT_SX = { display: 'flex', alignItems: 'center', gap: 0.75 } as const
const KEY_SX = {
  px: 0.75,
  borderRadius: '6px',
  border: 1,
  borderColor: 'divider',
  bgcolor: 'background.paper',
  fontFamily: 'inherit'
} as const

// The field takes the focus, not the dialog as MUI would (`disableAutoFocus`):
// a ref, as the portal of the dialog mounts after the first effects
function focusFirstField(body: HTMLDivElement | null): void {
  body?.querySelector('input')?.focus()
}

export interface SpotlightHint {
  /** The key as written on it: `↑↓`, `Esc` */
  keys: string
  label: string
}

export interface SpotlightProps {
  /** Visible title, and the name of the dialog */
  title: string
  /** The keys listed at the bottom, a reminder for mouse users */
  hints: readonly SpotlightHint[]
  /** Escape, a click outside */
  onClose: () => void
  /** The search, an inline `SearchCombobox`, which takes the room left */
  children: ReactNode
  'data-testid'?: string
}

function isFocusLost(): boolean {
  const active = document.activeElement
  return active === null || active === document.body || !active.isConnected
}

/**
 * A quick switcher: the dialog takes the focus to its first field. Closed,
 * it gives the focus back to what had it only when nothing took it since: a
 * choice that opens another page leaves the focus to that page, which MUI
 * would not (`disableRestoreFocus`). The hints repeat what the field already
 * announces, so they are hidden from assistive technologies.
 */
export function Spotlight({
  title,
  hints,
  onClose,
  children,
  'data-testid': testId
}: SpotlightProps): ReactElement {
  const titleId = useId()
  // Read while rendering: the field has the focus by the first effect
  const [opener] = useState(() => document.activeElement)
  useEffect(
    () => () => {
      // After the effects of the page a choice opens, which focus it
      setTimeout(() => {
        if (isFocusLost() && opener instanceof HTMLElement) opener.focus()
      })
    },
    [opener]
  )
  return (
    <Dialog
      open
      disableAutoFocus
      disableRestoreFocus
      size="medium"
      aria-labelledby={titleId}
      onClose={onClose}
      slotProps={{ paper: { sx: PAPER_SX } }}
      data-testid={testId}
    >
      <Typography
        id={titleId}
        component="h2"
        variant="h6"
        className="u-ph-1-half u-pt-1"
      >
        {title}
      </Typography>
      <Box ref={focusFirstField} sx={BODY_SX} className="u-pv-1">
        {children}
      </Box>
      <Box sx={HINTS_SX} aria-hidden="true">
        {hints.map(hint => (
          <Typography
            key={hint.keys}
            variant="caption"
            color="textSecondary"
            sx={HINT_SX}
          >
            <Box component="kbd" sx={KEY_SX}>
              {hint.keys}
            </Box>
            {hint.label}
          </Typography>
        ))}
      </Box>
    </Dialog>
  )
}
