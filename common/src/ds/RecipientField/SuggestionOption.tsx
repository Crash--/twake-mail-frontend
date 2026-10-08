// Upstream to twake-ui: with RecipientField. A suggestion as tmail-flutter's
// `RecipientSuggestionItemWidget`: 60 px, a 40 px light avatar holding the
// initials, the name in 16 px black and the address in 13 px grey, what is
// typed in bold; one already among the recipients sits in a grey rounded
// box with a blue tick.
import { Icon } from '@linagora/twake-icons'
import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { SelectedIcon } from '@/ds/RecipientIcons/RecipientIcons'

import { initialsOf, splitMatches } from './initials'

const OPTION_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  height: 60,
  boxSizing: 'border-box',
  px: 2,
  cursor: 'pointer',
  bgcolor: '#FFFFFF',
  '&[aria-selected="true"]': { bgcolor: '#F2F3F5' },
  '&:hover': { bgcolor: '#F2F3F5' }
} as const

const ADDED_OPTION_SX = {
  ...OPTION_SX,
  m: 1,
  borderRadius: '20px',
  cursor: 'default',
  bgcolor: 'rgba(222, 226, 231, 0.5)',
  '&[aria-selected="true"], &:hover': { bgcolor: 'rgba(222, 226, 231, 0.5)' }
} as const

const AVATAR_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: 40,
  height: 40,
  boxSizing: 'border-box',
  borderRadius: '50%',
  bgcolor: '#F8F8F8',
  border: '1px solid rgba(0, 0, 0, 0.08)',
  color: '#000000',
  fontSize: 16,
  fontWeight: 600,
  lineHeight: 1,
  // Drawn, not written: the name of the option is its text
  '&::before': { content: 'attr(data-initials)' }
} as const

const LINES_SX = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  flex: 1,
  minWidth: 0
} as const

const PRIMARY_SX = {
  fontSize: 16,
  lineHeight: '20px',
  color: '#000000',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  '& b': { fontWeight: 700 }
} as const

const SECONDARY_SX = {
  ...PRIMARY_SX,
  fontSize: 13,
  lineHeight: '16px',
  color: '#818C99',
  '& b': { fontWeight: 700, color: '#000000' }
} as const

function Highlighted({
  text,
  query
}: {
  text: string
  query: string
}): ReactElement {
  return (
    <>
      {splitMatches(text, query).map((part, index) =>
        part.isMatch ? <b key={index}>{part.text}</b> : part.text
      )}
    </>
  )
}

export interface SuggestionOptionProps {
  id: string
  label: string
  secondary?: string
  /** Already among the recipients: shown ticked, not picked again */
  isAdded: boolean
  /** Said after the name of an added one, e.g. "already added" */
  addedLabel: string
  /** What is typed, in bold where it matches */
  query: string
  isActive: boolean
  onSelect: () => void
}

/** One suggestion of a `RecipientField` (`role="option"`) */
export function SuggestionOption({
  id,
  label,
  secondary,
  isAdded,
  addedLabel,
  query,
  isActive,
  onSelect
}: SuggestionOptionProps): ReactElement {
  return (
    <Box
      component="li"
      id={id}
      role="option"
      // The bold parts would cut the words of a name computed from the text
      aria-label={[label, secondary, isAdded ? addedLabel : undefined]
        .filter(part => part !== undefined)
        .join(', ')}
      aria-selected={isActive}
      aria-disabled={isAdded ? true : undefined}
      sx={isAdded ? ADDED_OPTION_SX : OPTION_SX}
      onClick={isAdded ? undefined : onSelect}
    >
      <Box
        component="span"
        aria-hidden="true"
        data-initials={initialsOf(label)}
        sx={AVATAR_SX}
      />
      <Box component="span" sx={LINES_SX}>
        <Box component="span" sx={PRIMARY_SX}>
          <Highlighted text={label} query={query} />
        </Box>
        {secondary === undefined ? null : (
          <Box component="span" sx={SECONDARY_SX}>
            <Highlighted text={secondary} query={query} />
          </Box>
        )}
      </Box>
      {isAdded ? (
        <Box component="span" className="u-flex" sx={{ color: '#007AFF' }}>
          <Icon icon={SelectedIcon} size={24} aria-hidden="true" />
        </Box>
      ) : null}
    </Box>
  )
}
