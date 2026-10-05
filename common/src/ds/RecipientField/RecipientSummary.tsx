// Upstream to twake-ui: with RecipientField.
import { ButtonBase, Typography } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

export interface RecipientSummaryProps {
  /** What the fields hold, in short ("Alice, Bob +2") */
  summary: string
  /** Read before the summary, not shown ("Show all the recipients:") */
  label: string
  onExpand: () => void
  'data-testid'?: string
}

/**
 * Recipient fields folded into one line, as tall as a field: a button
 * that unfolds them. Its name is the label then the summary it shows.
 */
export function RecipientSummary({
  summary,
  label,
  onExpand,
  'data-testid': testId
}: RecipientSummaryProps): ReactElement {
  return (
    <ButtonBase
      onClick={onExpand}
      className="u-w-100 u-ov-hidden"
      sx={{
        justifyContent: 'flex-start',
        minHeight: 37,
        px: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&.Mui-focusVisible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: -2
        }
      }}
      data-testid={testId}
    >
      <Typography noWrap variant="body2" component="span">
        <span className="u-visuallyhidden">{label} </span>
        {summary}
      </Typography>
    </ButtonBase>
  )
}
