// Upstream to twake-ui: no, the look of tmail-flutter's keyboard shortcuts
// (`ShortcutRow`, `ShortcutKeyWidget`): what the shortcut does in Regular 14
// black, its keys at the end of a row 440 px wide at most, each a light
// blue key cap (#DFEEFF, a #CCCCCC border, a radius of 2) in 12 px. A table
// for assistive technologies, its header read but not shown.
import { Box } from '@linagora/twake-mui'
import { Fragment, type ReactElement } from 'react'

import { TMAIL } from '@/ds/TmailColors/tmailColors'

const TABLE_SX = {
  width: '100%',
  maxWidth: 440,
  borderCollapse: 'collapse',
  '& th, & td': { p: 0, pt: '5px', pb: '21px', verticalAlign: 'middle' }
} as const

const LABEL_SX = {
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 400,
  color: TMAIL.textBlack,
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
  border: `1px solid ${TMAIL.outlineKey}`,
  bgcolor: TMAIL.blueSelected,
  fontFamily: 'inherit',
  fontSize: 12,
  lineHeight: '16px',
  fontWeight: 500,
  letterSpacing: '0.4px',
  color: TMAIL.textBlack88,
  textTransform: 'uppercase'
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
  label: string
}

export interface ShortcutListProps {
  /** Id of the heading naming the table */
  labelledBy: string
  /** Header of the columns, for assistive technologies */
  actionHeader: string
  keyHeader: string
  rows: readonly ShortcutListRow[]
}

/** A group of keyboard shortcuts: what each does, then its keys */
export function ShortcutList({
  labelledBy,
  actionHeader,
  keyHeader,
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
              <kbd>
                {splitKeys(row.keys).map((key, index) => (
                  <Fragment key={`${key}-${index}`}>
                    {/* Read between the key caps, which the eye sees */}
                    {index > 0 ? (
                      <span className="u-visuallyhidden"> + </span>
                    ) : null}
                    <Box component="kbd" sx={CAP_SX}>
                      {key}
                    </Box>
                  </Fragment>
                ))}
              </kbd>
            </Box>
          </tr>
        ))}
      </tbody>
    </Box>
  )
}
