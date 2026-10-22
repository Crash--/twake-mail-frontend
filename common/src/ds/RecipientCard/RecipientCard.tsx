// Upstream to twake-ui: no, the card of a recipient of the composer, which
// opens under the recipient tag tapped: 361 px wide (less on a narrow
// screen), an avatar, the name and the address with a copy button, then
// "Edit email" (filled) and "Create a rule" (outlined) buttons, and a close
// button in its corner. twake-mui's `ContactPopover` has other contents and
// actions.
import { Icon } from '@linagora/twake-icons'
import {
  Box,
  Button,
  IconButton,
  Popover,
  radius,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import { useId, useState, type ReactElement } from 'react'

import { GradientAvatar } from '@/ds/GradientAvatar/GradientAvatar'
import { CloseCardIcon, CopyIcon } from '@/ds/RecipientIcons/RecipientIcons'

const CARD_WIDTH = 361

const PAPER_SX = {
  position: 'relative',
  boxSizing: 'border-box',
  width: CARD_WIDTH,
  maxWidth: 'calc(100vw - 32px)',
  mt: 0.5,
  pt: '36px',
  px: 2,
  pb: '12px',
  borderRadius: radius.lg,
  bgcolor: 'background.paper'
} as const

const NAME_SX = {
  pr: 3,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
} as const

const ADDRESS_SX = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
} as const

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
 * The card of a recipient of the composer: a dialog
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
            <GradientAvatar text={initials} colorKey={initials} size={42} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {name === null || name === '' ? null : (
              <Typography variant="h5" component="p" id={titleId} sx={NAME_SX}>
                {name}
              </Typography>
            )}
            <Box className="u-flex u-flex-items-center">
              <Typography
                variant="body2"
                component="span"
                color="text.secondary"
                id={name === null || name === '' ? titleId : undefined}
                sx={ADDRESS_SX}
              >
                {address}
              </Typography>
              {/* Above and click-through: below, it covered the pills and
                  swallowed their clicks */}
              <Tooltip title={labels.copy} placement="top" disableInteractive>
                <IconButton
                  aria-label={labels.copy}
                  onClick={onCopy}
                  sx={{ ml: '7px', p: '4px', color: 'text.secondary' }}
                  data-testid={testIds.copy}
                >
                  <Icon icon={CopyIcon} size={20} aria-hidden="true" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Box>
        <Box className="u-flex" sx={{ mt: '12px', gap: 1 }}>
          <Button size="small" onClick={handleEdit} data-testid={testIds.edit}>
            {labels.edit}
          </Button>
          {onCreateRule === null ? null : (
            <Button
              size="small"
              variant="outlined"
              onClick={onCreateRule}
              data-testid={testIds.createRule}
            >
              {labels.createRule}
            </Button>
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
              color: 'text.secondary'
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
