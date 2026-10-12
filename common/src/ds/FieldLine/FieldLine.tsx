// Upstream to twake-ui: yes. twake-mui has outlined and filled text fields,
// not the flat line of a mail form (Figma "Mail composer fields"): a label on
// the left, the value inline, a full width divider below, 37 px high.
import { Box, Typography, type SxProps, type Theme } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'
import { TMAIL } from '@/ds/TmailColors/tmailColors'

/** Height of a line, divider included, in px (tmail-flutter's 48) */
export const FIELD_LINE_HEIGHT = 48

/**
 * The look of a line, shared with the fields that build their own markup
 * (`RecipientField`), as tmail-flutter's composer: 48 px, 24 px from the
 * start of the window (the light divider below too) and 24 px from its end,
 * the text of the inputs in Inter Regular 15 / 24 black, the placeholders
 * in steel grey (#8C9CAF).
 */
export const FIELD_LINE_SX = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: 0.5,
  rowGap: 0.5,
  minHeight: FIELD_LINE_HEIGHT,
  boxSizing: 'border-box',
  ml: '24px',
  pr: '24px',
  // 16 px on phones, as tmail-flutter
  [`@media ${SCREEN_QUERIES.mobile}`]: { ml: '16px', pr: '16px' },
  py: 0.5,
  borderBottom: `1px solid ${TMAIL.outlineF4}`,
  '& .MuiInputBase-input': { p: 0, height: '24px' },
  '& .MuiInputBase-input, & .MuiSelect-select': {
    fontSize: 15,
    fontWeight: 400,
    lineHeight: '24px',
    letterSpacing: 0,
    color: TMAIL.textBlack
  },
  '& .MuiInputBase-input::placeholder': {
    color: TMAIL.steelLight,
    opacity: 1
  }
} as const satisfies SxProps<Theme>

/** The label of a line, as tmail-flutter's "To:": Regular 15 / 24, steel grey */
export const FIELD_LABEL_SX = {
  color: TMAIL.steelLight,
  fontSize: 15,
  fontWeight: 400,
  lineHeight: '24px',
  pr: 1
} as const satisfies SxProps<Theme>

/** A single control per line: it shrinks rather than wraps */
const LINE_SX = { ...FIELD_LINE_SX, flexWrap: 'nowrap' } as const

export interface FieldLineProps {
  /** Name of the field; shown on the left unless `isLabelHidden` */
  label: string
  /** `id` of the control the label names */
  htmlFor?: string
  /** `id` of the label, for a control named with `aria-labelledby` */
  labelId?: string
  /** Keeps the label for assistive technologies: a placeholder says it */
  isLabelHidden?: boolean
  children: ReactNode
  /** After the control, at the end of the line */
  endActions?: ReactNode
}

/**
 * One line of a form: label, control and divider. The control brings its
 * own flat look (`InputBase`, or a `Select` without underline).
 */
export function FieldLine({
  label,
  htmlFor,
  labelId,
  isLabelHidden = false,
  children,
  endActions
}: FieldLineProps): ReactElement {
  return (
    <Box sx={LINE_SX}>
      <Typography
        component="label"
        id={labelId}
        htmlFor={htmlFor}
        variant="body2"
        className={isLabelHidden ? 'u-visuallyhidden' : undefined}
        sx={isLabelHidden ? undefined : FIELD_LABEL_SX}
      >
        {label}
      </Typography>
      <Box
        className="u-flex u-flex-auto u-flex-items-center"
        sx={{ minWidth: 0 }}
      >
        {children}
      </Box>
      {endActions}
    </Box>
  )
}
