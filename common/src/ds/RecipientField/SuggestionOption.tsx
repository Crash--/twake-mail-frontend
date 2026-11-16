// Upstream to twake-ui: with RecipientField. A suggestion as a twake-mui
// list row: the avatar, the name and the address, what is typed in bold.
import { ListItemButton, ListItemIcon, ListItemText } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { GradientAvatar } from '@/ds/GradientAvatar/GradientAvatar'

import { initialsOf, splitMatches } from './initials'

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
  query,
  isActive,
  onSelect
}: SuggestionOptionProps): ReactElement {
  const initials = initialsOf(label)
  return (
    <ListItemButton
      component="li"
      id={id}
      role="option"
      // The focus stays in the input (`aria-activedescendant`)
      tabIndex={-1}
      // The bold parts would cut the words of a name computed from the text
      aria-label={secondary === undefined ? label : `${label}, ${secondary}`}
      aria-selected={isActive}
      selected={isActive}
      onClick={onSelect}
    >
      <ListItemIcon>
        <GradientAvatar text={initials} colorKey={secondary ?? label} />
      </ListItemIcon>
      <ListItemText
        primary={<Highlighted text={label} query={query} />}
        secondary={
          secondary === undefined ? undefined : (
            <Highlighted text={secondary} query={query} />
          )
        }
      />
    </ListItemButton>
  )
}
