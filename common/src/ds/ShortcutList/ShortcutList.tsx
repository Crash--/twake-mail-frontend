// Upstream to twake-ui: no. The keyboard shortcuts: what the shortcut does,
// its keys at the end of a row 630 px wide at most, each a key cap on
// `action.selected` with a `border.main` outline. A table for assistive
// technologies, its header read but not shown.
import { Box } from '@linagora/twake-mui'
import { Fragment, type ReactElement } from 'react'

export const SHORTCUTS_WIDTH = 630

const TABLE_SX = {
  width: '100%',
  maxWidth: SHORTCUTS_WIDTH,
  borderCollapse: 'collapse',
  '& th, & td': { p: 0, pt: '5px', pb: '21px', verticalAlign: 'middle' }
} as const

const LABEL_SX = {
  typography: 'body1',
  color: 'text.primary',
  textAlign: 'start'
} as const

const KEYS_SX = {
  textAlign: 'end',
  whiteSpace: 'nowrap',
  pl: 2,
  '& kbd': { fontFamily: 'inherit' }
} as const

const CAP_SX = {
  display: 'inline-block',
  ml: '4px',
  p: '6px',
  borderRadius: '2px',
  border: '1px solid',
  borderColor: 'border.main',
  bgcolor: 'action.selected',
  fontFamily: 'inherit',
  typography: 'caption',
  color: 'text.primary',
  textTransform: 'uppercase'
} as const

const OR_SX = {
  ml: '4px',
  typography: 'caption',
  color: 'text.primary'
} as const

/** "Ctrl+Enter" → ["Ctrl", "Enter"]; "+" and "Ctrl++" keep their plus */
export function splitKeys(keys: string): string[] {
  if (keys === '+') return ['+']
  const parts = keys.split('+').map(part => part.trim())
  return parts.flatMap((part, index) =>
    part === '' && index === parts.length - 1
      ? ['+']
      : part === ''
        ? []
        : [part]
  )
}

export interface ShortcutListRow {
  /** The keys, joined by "+", e.g. "Ctrl+Enter" */
  keys: string
  /** Other keys doing the same, each joined by "+" too */
  alternatives?: readonly string[]
  label: string
}

export interface ShortcutListProps {
  /** Id of the heading naming the table */
  labelledBy: string
  /** Header of the columns, for assistive technologies */
  actionHeader: string
  keyHeader: string
  /** Between the alternatives of a row, e.g. "or" */
  orLabel: string
  rows: readonly ShortcutListRow[]
}

/** The key caps of one combination, read with a plus between them */
function KeyCombination({ keys }: { keys: string }): ReactElement {
  return (
    <kbd>
      {splitKeys(keys).map((key, index) => (
        <Fragment key={`${key}-${index}`}>
          {/* Read between the key caps, which the eye sees */}
          {index > 0 ? <span className="u-visuallyhidden"> + </span> : null}
          <Box component="kbd" sx={CAP_SX}>
            {key}
          </Box>
        </Fragment>
      ))}
    </kbd>
  )
}

/** A group of keyboard shortcuts: what each does, then its keys */
export function ShortcutList({
  labelledBy,
  actionHeader,
  keyHeader,
  orLabel,
  rows
}: ShortcutListProps): ReactElement {
  return (
    <Box component="table" aria-labelledby={labelledBy} sx={TABLE_SX}>
      <thead className="u-visuallyhidden">
        <tr>
          <th scope="col">{actionHeader}</th>
          <th scope="col">{keyHeader}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.keys}>
            <Box component="td" sx={LABEL_SX}>
              {row.label}
            </Box>
            <Box component="td" sx={KEYS_SX}>
              {[row.keys, ...(row.alternatives ?? [])].map((keys, index) => (
                <Fragment key={keys}>
                  {index > 0 ? (
                    <Box component="span" sx={OR_SX}>
                      {` ${orLabel} `}
                    </Box>
                  ) : null}
                  <KeyCombination keys={keys} />
                </Fragment>
              ))}
            </Box>
          </tr>
        ))}
      </tbody>
    </Box>
  )
}
