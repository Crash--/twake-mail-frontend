// Upstream to twake-ui: yes, a list of people as Twake MUI draws it (Figma
// "Teammail 1.1", Delegation): a card with a 1 px border and a 12 px
// radius, one 56 px row per person (a 32 px avatar, the name in Regular 16,
// its address under it in Regular 12, an action at the end), divided by
// 1 px lines; and the card of a list still empty: its title, a text and
// an action, centred.
import { Box, Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import {
  GradientAvatar,
  firstLetterOf
} from '@/ds/GradientAvatar/GradientAvatar'

const CARD_SX = {
  m: 0,
  p: 0,
  listStyle: 'none',
  maxWidth: 489,
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: '12px',
  bgcolor: 'background.paper',
  overflow: 'hidden'
} as const

const ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  minHeight: 56,
  px: 2,
  py: 1,
  boxSizing: 'border-box',
  '& + &': { borderTop: '1px solid', borderColor: 'divider' }
} as const

const NAME_SX = {
  typography: 'body1',
  color: 'text.primary',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
} as const

const ADDRESS_SX = {
  typography: 'caption',
  color: 'text.secondary',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
} as const

const EMPTY_SX = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: 1,
  maxWidth: 489,
  px: 3,
  py: 5,
  boxSizing: 'border-box',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: '12px',
  bgcolor: 'background.paper'
} as const

export interface Person {
  /** Unique in the list */
  id: string
  name: string
  /** Under the name; none when the name is the address */
  address?: string | null
  /** Picks the colour of the avatar, e.g. the address */
  avatarKey: string
}

export interface PeopleListProps {
  people: readonly Person[]
  /** Names the list */
  label: string
  /** At the end of a row, e.g. a remove button; none for a read-only list */
  renderAction?: (person: Person) => ReactNode
  'data-testid'?: string
  /** On every row */
  itemTestId?: string
}

/** A person: avatar, name and address, e.g. in a list or a dialog */
export function PersonSummary({ person }: { person: Person }): ReactElement {
  return (
    <>
      <GradientAvatar
        text={firstLetterOf(person.name)}
        colorKey={person.avatarKey}
        size={32}
      />
      <Box className="u-flex u-flex-column" sx={{ minWidth: 0, flex: 1 }}>
        <Typography component="span" sx={NAME_SX}>
          {person.name}
        </Typography>
        {person.address === null || person.address === undefined ? null : (
          <Typography component="span" sx={ADDRESS_SX}>
            {person.address}
          </Typography>
        )}
      </Box>
    </>
  )
}

/** People in a bordered card, one row each */
export function PeopleList({
  people,
  label,
  renderAction,
  'data-testid': testId,
  itemTestId
}: PeopleListProps): ReactElement {
  return (
    <Box component="ul" aria-label={label} sx={CARD_SX} data-testid={testId}>
      {people.map(person => (
        <Box
          component="li"
          key={person.id}
          sx={ROW_SX}
          data-testid={itemTestId}
          data-email={person.avatarKey}
        >
          <PersonSummary person={person} />
          {renderAction?.(person)}
        </Box>
      ))}
    </Box>
  )
}

/**
 * The column of a page about people, as wide as their card (489 px), the
 * whole width on a phone: its texts wrap as the maquette's
 */
export function PeopleColumn({
  children
}: {
  children: ReactNode
}): ReactElement {
  return <Box sx={{ maxWidth: 489 }}>{children}</Box>
}

/** One person in a bordered card, e.g. the one a dialog is about */
export function PersonCard({
  person,
  'data-testid': testId
}: {
  person: Person
  'data-testid'?: string
}): ReactElement {
  return (
    <Box sx={{ ...ROW_SX, ...CARD_SX, display: 'flex' }} data-testid={testId}>
      <PersonSummary person={person} />
    </Box>
  )
}

export interface PeopleEmptyCardProps {
  title: string
  text: string
  /** Under the text, e.g. an "Add" button */
  action?: ReactNode
  'data-testid'?: string
}

/** The card of a list of people still empty */
export function PeopleEmptyCard({
  title,
  text,
  action,
  'data-testid': testId
}: PeopleEmptyCardProps): ReactElement {
  return (
    <Box sx={EMPTY_SX} data-testid={testId}>
      <Typography
        component="p"
        sx={{ m: 0, typography: 'subtitle1', color: 'text.primary' }}
      >
        {title}
      </Typography>
      <Typography
        component="p"
        sx={{ m: 0, typography: 'body1', color: 'text.secondary' }}
      >
        {text}
      </Typography>
      {action === undefined ? null : <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  )
}
