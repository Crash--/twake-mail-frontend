// Upstream to twake-ui: yes. twake-mui has outlined and filled text fields,
// not the flat line of a mail form (Figma "Mail composer fields"): a label on
// the left, the value inline, a full width divider below, 37 px high.
import { Box, Typography, type SxProps, type Theme } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

/** Height of a line, divider included, in px */
export const FIELD_LINE_HEIGHT = 37

/**
 * The look of a line, shared with the fields that build their own markup
 * (`RecipientField`): 37 px, 16 px on each side, a divider below, and the
 * text of the inputs in it set in Inter Medium 14 / 20.
 */
export const FIELD_LINE_SX: SxProps<Theme> = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: 0.5,
  rowGap: 0.5,
  minHeight: FIELD_LINE_HEIGHT,
  boxSizing: 'border-box',
  px: 2,
  py: 0.5,
  borderBottom: '1px solid',
  borderColor: 'divider',
  '&:focus-within': { borderColor: 'primary.main' },
  '& .MuiInputBase-input': { p: 0, height: '20px' },
  '& .MuiInputBase-input, & .MuiSelect-select': {
    fontSize: 14,
    fontWeight: 500,
    lineHeight: '20px',
    letterSpacing: '0.1px',
    color: 'text.primary'
  },
  '& .MuiInputBase-input::placeholder': {
    color: 'text.secondary',
    opacity: 1
  }
}

/** The label of a line: Inter Medium 14 / 18.4 in the secondary colour */
export const FIELD_LABEL_SX: SxProps<Theme> = {
  color: 'text.secondary',
  pr: 1,
  minWidth: 40
}

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
    <Box sx={FIELD_LINE_SX}>
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
      <Box className="u-flex u-flex-auto u-flex-items-center">{children}</Box>
      {endActions}
    </Box>
  )
}
