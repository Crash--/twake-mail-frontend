// Upstream to twake-ui: no, the look of tmail-flutter's dialog while a
// message is sent (`SendingMessageDialogView`): 400 px wide, a 12 px
// radius, the title in Bold 17 black on a light grey (#F2F3F5) band, a
// divider, then "Status: <step>..." and "Progress:" with a sliding bar,
// light on the primary blue. It cannot be dismissed: it goes once the
// message is sent or failed.
import {
  Box,
  Dialog,
  Divider,
  LinearProgress,
  Typography
} from '@linagora/twake-mui'
import { useId, type ReactElement } from 'react'

const PAPER_SX = {
  width: 'min(400px, calc(100% - 48px))',
  m: '16px 24px',
  borderRadius: '12px',
  backgroundColor: '#FFFFFF'
} as const

const TITLE_SX = {
  py: 1,
  px: 1.5,
  borderRadius: '12px',
  backgroundColor: '#F2F3F5',
  textAlign: 'center',
  fontSize: 17,
  fontWeight: 700,
  lineHeight: '22px',
  color: '#000000'
} as const

const LABEL_SX = {
  flexShrink: 0,
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '20px',
  color: '#000000'
} as const

const VALUE_SX = {
  fontSize: 14,
  lineHeight: '20px',
  color: '#71767C'
} as const

const BAR_SX = {
  flex: 1,
  height: 4,
  borderRadius: '12px',
  // As tmail-flutter: a light bar sliding on the primary blue
  '&&': { backgroundColor: '#007AFF' },
  '&& .MuiLinearProgress-bar': {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: '12px'
  }
} as const

export interface SendingDialogProps {
  open: boolean
  /** "Sending message" */
  title: string
  /** "Status" */
  statusLabel: string
  /** The step under way, e.g. "Creating message" */
  status: string
  /** "Progress" */
  progressLabel: string
  'data-testid'?: string
}

/**
 * A modal dialog saying that a message is being sent: its title, the step
 * under way and an indeterminate progress bar. It takes the focus (its
 * content is announced) and gives it back when it closes; neither Escape
 * nor a click outside closes it.
 */
export function SendingDialog({
  open,
  title,
  statusLabel,
  status,
  progressLabel,
  'data-testid': testId
}: SendingDialogProps): ReactElement {
  const titleId = useId()
  const statusId = useId()
  const progressId = useId()
  return (
    <Dialog
      open={open}
      aria-labelledby={titleId}
      aria-describedby={statusId}
      aria-busy
      slotProps={{ paper: { sx: PAPER_SX } }}
      data-testid={testId}
    >
      <Typography id={titleId} component="h2" sx={TITLE_SX}>
        {title}
      </Typography>
      <Divider />
      <Box sx={{ pt: 1.5, pb: 0.5, px: 2 }} className="u-flex">
        <Typography component="span" sx={LABEL_SX}>
          {`${statusLabel}:`}
        </Typography>
        <Typography
          id={statusId}
          component="span"
          role="status"
          className="u-ml-half"
          sx={VALUE_SX}
        >
          {`${status}...`}
        </Typography>
      </Box>
      <Box
        sx={{ pt: 0.5, pb: 2, px: 2 }}
        className="u-flex u-flex-items-center"
      >
        <Typography id={progressId} component="span" sx={LABEL_SX}>
          {`${progressLabel}:`}
        </Typography>
        <LinearProgress
          aria-labelledby={progressId}
          className="u-ml-half"
          sx={BAR_SX}
        />
      </Box>
    </Dialog>
  )
}
