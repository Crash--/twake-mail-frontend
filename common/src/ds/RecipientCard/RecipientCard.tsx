// Upstream to twake-ui: no, the look of tmail-flutter's card of a recipient
// of its composer (`DesktopEditRecipientsView`), which opens under the
// recipient tag tapped: 361 px wide (less on a narrow screen), rounded by
// 16 px, a 42 px gradient avatar, the name in Medium 16 and the address in
// grey 15 with a copy button, then "Edit email" (filled) and "Create a rule"
// (outlined) pills, and a close button in its corner. twake-mui's
// `ContactPopover` has other contents and actions.
import { Icon } from '@linagora/twake-icons'
import {
  Box,
  ButtonBase,
  IconButton,
  Popover,
  Tooltip
} from '@linagora/twake-mui'
import { useId, useState, type ReactElement } from 'react'

import { GradientAvatar } from '@/ds/GradientAvatar/GradientAvatar'
import { CloseCardIcon, CopyIcon } from '@/ds/RecipientIcons/RecipientIcons'
import { TMAIL } from '@/ds/TmailColors/tmailColors'

const CARD_WIDTH = 361
const PRIMARY = TMAIL.primary0A
/** The filled pill keeps that blue, its label white, in both schemes */
const PRIMARY_FILL = '#0A84FF'

const PAPER_SX = {
  position: 'relative',
  boxSizing: 'border-box',
  width: CARD_WIDTH,
  maxWidth: 'calc(100vw - 32px)',
  mt: 0.5,
  pt: '36px',
  px: 2,
  pb: '12px',
  borderRadius: '16px',
  bgcolor: TMAIL.surface,
  boxShadow: '0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3)'
} as const

const NAME_SX = {
  m: 0,
  pr: 3,
  fontSize: 16,
  lineHeight: '24px',
  fontWeight: 500,
  letterSpacing: '0.15px',
  color: TMAIL.textGrey,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
} as const

const ADDRESS_SX = {
  minWidth: 0,
  fontSize: 15,
  lineHeight: '20px',
  color: TMAIL.grey,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
} as const

function pillSx(isFilled: boolean): Record<string, unknown> {
  return {
    height: 36,
    minWidth: isFilled ? 127 : 134,
    flex: '0 1 auto',
    boxSizing: 'border-box',
    px: '10px',
    borderRadius: '100px',
    border: `1px solid ${isFilled ? PRIMARY_FILL : PRIMARY}`,
    bgcolor: isFilled ? PRIMARY_FILL : TMAIL.surface,
    color: isFilled ? '#FFFFFF' : PRIMARY,
    fontSize: 14,
    lineHeight: '20px',
    fontWeight: 500,
    letterSpacing: '0.1px',
    whiteSpace: 'nowrap',
    '&:hover': { bgcolor: isFilled ? '#0067D6' : TMAIL.blueHover06 }
  }
}

export interface RecipientCardLabels {
  /** "Copy the email address": the name and tooltip of the copy button */
  copy: string
  edit: string
  createRule: string
  close: string
}

export interface RecipientCardProps {
  open: boolean
  /** The tag the card opens under */
  anchorEl: HTMLElement | null
  onClose: () => void
  /** The name of the recipient, if any */
  name: string | null
  address: string
  /** The letters of the avatar, e.g. "AM" */
  initials: string
  labels: RecipientCardLabels
  onCopy: () => void
  /** Takes the recipient back into the input, to be corrected */
  onEdit: () => void
  /** Opens a new filtering rule for the address; none without rules */
  onCreateRule: (() => void) | null
  testIds?: {
    card?: string
    copy?: string
    edit?: string
    createRule?: string
    close?: string
  }
}

/**
 * The card of a recipient of the composer, as tmail-flutter's: a dialog
 * named by the recipient, under its tag. Escape or a click outside closes
 * it and the focus goes back to the tag; "Edit email" closes it for the
 * input, which takes the focus.
 */
export function RecipientCard({
  open,
  anchorEl,
  onClose,
  name,
  address,
  initials,
  labels,
  onCopy,
  onEdit,
  onCreateRule,
  testIds = {}
}: RecipientCardProps): ReactElement {
  const titleId = useId()
  // "Edit email" gives the focus to the input, not back to the tag
  const [isRestoringFocus, setIsRestoringFocus] = useState(true)

  const handleEdit = (): void => {
    setIsRestoringFocus(false)
    onEdit()
  }

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      disableRestoreFocus={!isRestoringFocus}
      slotProps={{
        transition: {
          onExited: () => {
            setIsRestoringFocus(true)
          }
        },
        paper: {
          role: 'dialog',
          'aria-labelledby': titleId,
          sx: PAPER_SX
        }
      }}
    >
      <Box data-testid={testIds.card}>
        <Box className="u-flex u-flex-items-center">
          <Box component="span" className="u-flex-shrink-0" sx={{ mr: 2 }}>
            <GradientAvatar
              text={initials}
              colorKey={initials}
              size={42}
              fontSize={16}
            />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {name === null || name === '' ? null : (
              <Box component="p" id={titleId} sx={NAME_SX}>
                {name}
              </Box>
            )}
            <Box className="u-flex u-flex-items-center">
              <Box
                component="span"
                id={name === null || name === '' ? titleId : undefined}
                sx={ADDRESS_SX}
              >
                {address}
              </Box>
              <Tooltip title={labels.copy}>
                <IconButton
                  aria-label={labels.copy}
                  onClick={onCopy}
                  sx={{ ml: '7px', p: '4px', color: TMAIL.grey }}
                  data-testid={testIds.copy}
                >
                  <Icon icon={CopyIcon} size={20} aria-hidden="true" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Box>
        <Box className="u-flex" sx={{ mt: '12px', gap: 1 }}>
          <ButtonBase
            onClick={handleEdit}
            sx={pillSx(true)}
            data-testid={testIds.edit}
          >
            {labels.edit}
          </ButtonBase>
          {onCreateRule === null ? null : (
            <ButtonBase
              onClick={onCreateRule}
              sx={pillSx(false)}
              data-testid={testIds.createRule}
            >
              {labels.createRule}
            </ButtonBase>
          )}
        </Box>
        <Tooltip title={labels.close}>
          <IconButton
            aria-label={labels.close}
            onClick={onClose}
            sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              p: '10px',
              color: TMAIL.steelLight
            }}
            data-testid={testIds.close}
          >
            <Icon icon={CloseCardIcon} size={24} aria-hidden="true" />
          </IconButton>
        </Tooltip>
      </Box>
    </Popover>
  )
}
