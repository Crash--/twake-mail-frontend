// Upstream to twake-ui: no, the look of tmail-flutter's modals (folder
// creation `MailboxCreatorView`, label creation `CreateNewLabelModal`…): a
// white card 554 px wide at most, rounded by 16 px, the close cross at the
// top end, the title centred (24 / 32), a grey line under it, the fields 32
// px in with their Semi Bold 14 labels above, and at the end a text button
// and the confirming 48 px blue pill. The small one (`EditTextDialogBuilder`,
// renaming a folder) is 383 px wide, its title Semi Bold. twake-mui's
// `Dialog` has its title at the start and its actions as outlined and
// contained buttons.
import { Icon } from '@linagora/twake-icons'
import {
  Box,
  Button,
  Dialog,
  IconButton,
  InputBase,
  MenuItem,
  Select,
  Tooltip,
  Typography,
  type InputBaseProps
} from '@mui/material'
import {
  forwardRef,
  type ComponentProps,
  type Ref,
  type SubmitEventHandler,
  type ReactElement,
  type ReactNode
} from 'react'

import {
  CloseDialog,
  Dropdown,
  FilterSelected
} from '@/ds/FlutterIcons/FlutterIcons'
import { TMAIL } from '@/ds/TmailColors/tmailColors'

/** `AppColor.m3SurfaceBackground` */
const TEXT_COLOR = TMAIL.textOnSurface
/** `AppColor.primaryMain` */
const PRIMARY = TMAIL.primary0A
/** The confirming pill keeps that blue, its label white, in both schemes */
const PRIMARY_FILL = '#0A84FF'
/** `AppColor.m3Neutral90`: the border of the fields */
const FIELD_BORDER = TMAIL.outline
/** `AppColor.m3Tertiary`: hints and the close cross */
const HINT_COLOR = TMAIL.steelLight
const ERROR_COLOR = TMAIL.error

const PAPER_SX = {
  width: 554,
  maxWidth: 'calc(100% - 32px)',
  maxHeight: 'min(671px, calc(100% - 100px))',
  m: 2,
  borderRadius: '16px',
  position: 'relative',
  boxSizing: 'border-box',
  boxShadow: '0 2px 24px rgba(0, 0, 0, 0.08), 0 0 2px rgba(0, 0, 0, 0.08)',
  display: 'flex',
  flexDirection: 'column'
} as const

const TITLE_SX = {
  m: 0,
  px: '56px',
  pt: '16px',
  pb: '16px',
  minHeight: 64,
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  fontSize: 24,
  fontWeight: 400,
  lineHeight: '32px',
  color: TEXT_COLOR
} as const

/** The small modal: `EditTextDialogBuilder` */
const SMALL_TITLE_SX = {
  ...TITLE_SX,
  mt: '12px',
  minHeight: 48,
  py: 0,
  pl: '24px',
  pr: '28px',
  fontWeight: 600
} as const

const SMALL_BODY_SX = {
  pl: '24px',
  pr: '28px',
  pt: '28px',
  overflowY: 'auto',
  flex: '1 1 auto'
} as const

const SUBTITLE_SX = {
  m: 0,
  px: '32px',
  pb: '16px',
  textAlign: 'center',
  fontSize: 13,
  lineHeight: '20px',
  color: TMAIL.steel
} as const

const BODY_SX = {
  px: '32px',
  pt: '16px',
  overflowY: 'auto',
  flex: '1 1 auto'
} as const

const ACTIONS_SX = {
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '8px',
  px: '32px',
  py: '25px',
  flexShrink: 0
} as const

export interface ModalDialogProps {
  open?: boolean
  /** Shown centred at the top, and the name of the dialog */
  title: ReactNode
  /** The grey line under the title, e.g. where a new folder goes */
  subtitle?: ReactNode
  titleId: string
  /** Id of what describes the dialog, for `aria-describedby` */
  describedBy?: string
  /** Names the close cross */
  closeLabel: string
  onClose: () => void
  /** Called once the dialog is gone (its transition ended) */
  onExited?: () => void
  /** Given, the content is a form submitted by the confirming button */
  onSubmit?: SubmitEventHandler<HTMLFormElement>
  /** The fields */
  children: ReactNode
  /** The buttons at the end, `ModalDialogButton`s, the confirming one last */
  actions?: ReactNode
  /** `small`: 383 px, as the dialog renaming a folder */
  size?: 'large' | 'small'
  /** The title in Semi Bold (`textStyleM3HeadlineSmall`), as the recovery form */
  isTitleStrong?: boolean
  /** `body`: the subtitle in Regular 16 / 24, dark (`LimitsBanner`) */
  subtitleLook?: 'caption' | 'body'
  /** Wider or narrower than 554 px */
  width?: number
  'data-testid'?: string
}

/**
 * A modal of tmail-flutter: named by its title, the focus kept inside,
 * Escape and the cross close it and give the focus back to what opened it.
 */
export function ModalDialog({
  open = true,
  title,
  subtitle,
  titleId,
  describedBy,
  closeLabel,
  onClose,
  onExited,
  onSubmit,
  children,
  actions,
  size = 'large',
  isTitleStrong = false,
  subtitleLook = 'caption',
  width,
  'data-testid': testId
}: ModalDialogProps): ReactElement {
  const isSmall = size === 'small'
  const paperWidth = width ?? (isSmall ? 383 : 554)
  const content = (
    <>
      <Typography
        id={titleId}
        component="h2"
        sx={
          isSmall
            ? SMALL_TITLE_SX
            : isTitleStrong
              ? { ...TITLE_SX, fontWeight: 600 }
              : TITLE_SX
        }
      >
        {title}
      </Typography>
      {subtitle === undefined ? null : (
        <Typography
          id={describedBy}
          component="p"
          sx={
            subtitleLook === 'body'
              ? {
                  ...SUBTITLE_SX,
                  fontSize: 16,
                  lineHeight: '24px',
                  letterSpacing: '-0.15px',
                  color: TEXT_COLOR
                }
              : SUBTITLE_SX
          }
        >
          {subtitle}
        </Typography>
      )}
      <Box sx={isSmall ? SMALL_BODY_SX : BODY_SX}>{children}</Box>
      {actions === undefined ? (
        <Box sx={{ height: 32, flexShrink: 0 }} />
      ) : (
        <Box
          sx={isSmall ? { ...ACTIONS_SX, pl: '24px', pr: '28px' } : ACTIONS_SX}
          className={isSmall ? 'ModalDialog-small' : undefined}
        >
          {actions}
        </Box>
      )}
    </>
  )
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      slotProps={{
        paper: {
          sx: { ...PAPER_SX, width: paperWidth }
        },
        transition: { onExited }
      }}
      data-testid={testId}
    >
      {onSubmit === undefined ? (
        content
      ) : (
        <Box
          component="form"
          onSubmit={onSubmit}
          noValidate
          sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
        >
          {content}
        </Box>
      )}
      <Tooltip title={closeLabel}>
        <IconButton
          aria-label={closeLabel}
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            p: '10px',
            color: HINT_COLOR
          }}
          data-testid={
            testId === undefined ? undefined : `${testId}-close-button`
          }
        >
          <Icon icon={CloseDialog} size={24} />
        </IconButton>
      </Tooltip>
    </Dialog>
  )
}

const BUTTON_SX = {
  height: 48,
  borderRadius: '100px',
  px: '16px',
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '20px',
  letterSpacing: '0.1px',
  textTransform: 'none',
  boxShadow: 'none',
  '&:hover': { boxShadow: 'none' }
} as const

export interface ModalDialogButtonProps {
  children: ReactNode
  onClick?: () => void
  /** The confirming action: a 153 px blue pill, else blue text */
  isMain?: boolean
  /** Submits the form of the dialog */
  type?: 'button' | 'submit'
  disabled?: boolean
  'data-testid'?: string
}

/** A button of `ModalDialog`, as `ModalListActionButtonWidget` */
export function ModalDialogButton({
  children,
  onClick,
  isMain = false,
  type = 'button',
  disabled = false,
  'data-testid': testId
}: ModalDialogButtonProps): ReactElement {
  return (
    <Button
      type={type}
      variant={isMain ? 'contained' : 'text'}
      onClick={onClick}
      disabled={disabled}
      sx={{
        ...BUTTON_SX,
        minWidth: isMain ? 153 : 67,
        // The small modal's pill is narrower
        '.ModalDialog-small &': { minWidth: isMain ? 119 : 67 },
        color: isMain ? '#FFFFFF' : PRIMARY,
        bgcolor: isMain ? PRIMARY_FILL : 'transparent',
        '&.Mui-disabled': {
          // `profileMenuDivider` at 12 %, its label at 38 %
          bgcolor: isMain ? TMAIL.disabledFill : 'transparent',
          color: TMAIL.textOnSurface38
        }
      }}
      data-testid={testId}
    >
      {children}
    </Button>
  )
}

const LABEL_SX = {
  display: 'block',
  mb: '16px',
  fontSize: 14,
  fontWeight: 600,
  lineHeight: '18px',
  color: TMAIL.textBlack
} as const

const INLINE_LABEL_SX = {
  width: 112,
  flexShrink: 0,
  minHeight: 40,
  display: 'flex',
  alignItems: 'center',
  fontSize: 14,
  fontWeight: 400,
  lineHeight: '18px',
  color: TMAIL.textBlack
} as const

export interface ModalFieldProps {
  label: ReactNode
  /** The control the label names */
  htmlFor?: string
  id?: string
  children: ReactNode
  /** Space above, in px: 0 for the first field */
  spaceAbove?: number
  /**
   * The label at the start of the row, 112 px wide, in Regular 14
   * (`DefaultLabelFieldWidget`, the recovery form)
   */
  isInline?: boolean
}

/** A field of `ModalDialog`: its Semi Bold label above the control */
export function ModalField({
  label,
  htmlFor,
  id,
  children,
  spaceAbove = 26,
  isInline = false
}: ModalFieldProps): ReactElement {
  if (isInline) {
    return (
      <Box
        sx={{
          mt: `${spaceAbove}px`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}
      >
        <Typography
          component={htmlFor === undefined ? 'span' : 'label'}
          htmlFor={htmlFor}
          id={id}
          sx={INLINE_LABEL_SX}
        >
          {label}
        </Typography>
        <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>{children}</Box>
      </Box>
    )
  }
  return (
    <Box sx={{ mt: `${spaceAbove}px` }}>
      <Typography
        component={htmlFor === undefined ? 'span' : 'label'}
        htmlFor={htmlFor}
        id={id}
        sx={LABEL_SX}
      >
        {label}
      </Typography>
      {children}
    </Box>
  )
}

function inputSx(
  hasError: boolean,
  isMultiline: boolean
): Record<string, unknown> {
  return {
    width: '100%',
    minHeight: 40,
    boxSizing: 'border-box',
    px: '12px',
    py: isMultiline ? '12px' : 0,
    alignItems: isMultiline ? 'flex-start' : 'center',
    border: '1px solid',
    borderColor: hasError ? ERROR_COLOR : FIELD_BORDER,
    borderRadius: '10px',
    bgcolor: hasError ? TMAIL.redWash : TMAIL.surface,
    fontSize: 14,
    lineHeight: '18px',
    color: TEXT_COLOR,
    '&.Mui-focused': { borderColor: hasError ? ERROR_COLOR : PRIMARY },
    '& .MuiInputBase-input': { p: 0, height: 'auto', lineHeight: '18px' },
    '& .MuiInputBase-input::placeholder': { color: HINT_COLOR, opacity: 1 }
  }
}

export interface ModalTextInputProps extends Omit<
  InputBaseProps,
  'sx' | 'error'
> {
  /** Shown red under the field, null for none */
  error?: string | null
  /** Id of the error line, for `aria-describedby` */
  errorId?: string
}

/** A text field of `ModalDialog`: 40 px, rounded by 10 px, blue when focused */
export const ModalTextInput = forwardRef<HTMLDivElement, ModalTextInputProps>(
  function ModalTextInput(
    { error = null, errorId, multiline, ...props },
    ref
  ): ReactElement {
    return (
      <>
        <InputBase
          ref={ref}
          multiline={multiline}
          {...props}
          sx={inputSx(error !== null, multiline === true)}
        />
        {error === null ? null : (
          <Typography
            id={errorId}
            component="p"
            sx={{
              mt: '8px',
              fontSize: 14,
              lineHeight: '18px',
              color: ERROR_COLOR
            }}
          >
            {error}
          </Typography>
        )}
      </>
    )
  }
)

export interface ModalSelectButtonProps {
  /** Before the value, e.g. a folder icon */
  icon?: ReactNode
  children: ReactNode
  onClick: () => void
  id?: string
  /** E.g. the label of its field and its own id: "Folder Inbox" */
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-haspopup'?: 'dialog' | 'menu' | 'listbox'
  'data-testid'?: string
}

/** A field opening a choice: its value, a chevron (`DefaultButtonArrowDownFieldWidget`) */
export function ModalSelectButton({
  icon,
  children,
  onClick,
  id,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-haspopup': hasPopup,
  'data-testid': testId
}: ModalSelectButtonProps): ReactElement {
  return (
    <Button
      variant="text"
      onClick={onClick}
      id={id}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-haspopup={hasPopup}
      sx={{
        width: '100%',
        height: 40,
        justifyContent: 'flex-start',
        gap: '12px',
        pl: '12px',
        pr: '8px',
        border: `1px solid ${FIELD_BORDER}`,
        borderRadius: '10px',
        textTransform: 'none',
        fontSize: 14,
        fontWeight: 400,
        lineHeight: '18px',
        color: TEXT_COLOR,
        bgcolor: TMAIL.surface,
        '&:hover': { bgcolor: TMAIL.hoverOnSurface },
        '& .ModalSelectButton-icon': { display: 'flex', color: PRIMARY },
        '& .ModalSelectButton-arrow': {
          display: 'flex',
          color: HINT_COLOR,
          ml: 'auto'
        }
      }}
      data-testid={testId}
    >
      {icon === undefined ? null : (
        <span className="ModalSelectButton-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <Box
        component="span"
        sx={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {children}
      </Box>
      <span className="ModalSelectButton-arrow" aria-hidden="true">
        <Icon icon={Dropdown} size={20} />
      </span>
    </Button>
  )
}

export interface ModalSelectOption {
  value: string
  label: string
}

/** What `ModalSelect` lets its parent do: focus it again */
export interface ModalSelectHandle {
  focus: () => void
}

export interface ModalSelectProps {
  /** Id of the label naming it */
  labelId: string
  value: string
  options: readonly ModalSelectOption[]
  /** Each pick, the option already chosen included */
  onChange: (value: string) => void
  /** Shown in the field instead of the label of the option, e.g. dates */
  valueLabel?: string
  selectRef?: Ref<ModalSelectHandle>
  /** On the field opening the list */
  'data-testid'?: string
}

/** tmail-flutter's `DateDropDownButton` menu: a card rounded by 16 px */
const SELECT_MENU_PAPER_SX = {
  mt: '4px',
  p: '12px',
  maxHeight: 332,
  boxSizing: 'border-box',
  borderRadius: '16px',
  border: `1px solid ${TMAIL.outlineMenu}`,
  boxShadow: '0 0 24px rgba(0, 0, 0, 0.12)',
  '& .MuiList-root': { p: 0 }
} as const

/** Its 44 px entries in Regular 15 black, a blue check after the one chosen */
const SELECT_ITEM_SX = {
  // The theme gives a menu item 48 px at least, whatever its padding
  minHeight: 44,
  height: 44,
  py: 0,
  px: '12px',
  gap: '8px',
  borderRadius: '8px',
  fontSize: 15,
  lineHeight: '20px',
  letterSpacing: '-0.15px',
  color: TMAIL.textBlack,
  '&.Mui-selected': { bgcolor: 'transparent' },
  '&:hover, &.Mui-selected:hover, &.Mui-focusVisible, &.Mui-selected.Mui-focusVisible':
    { bgcolor: TMAIL.hoverOnSurface08 }
} as const

/**
 * A list of choices in a field of `ModalDialog` (tmail-flutter's
 * `DateDropDownButton`): the field shows the choice and a chevron, its
 * menu drops under it with a check after the choice (a combobox and its
 * listbox)
 */
export function ModalSelect({
  labelId,
  value,
  options,
  onChange,
  valueLabel,
  selectRef,
  'data-testid': testId
}: ModalSelectProps): ReactElement {
  return (
    <Select
      value={value}
      labelId={labelId}
      inputRef={selectRef}
      renderValue={selected =>
        valueLabel ??
        options.find(option => option.value === selected)?.label ??
        ''
      }
      IconComponent={SelectChevron}
      input={<InputBase />}
      SelectDisplayProps={
        { 'data-testid': testId } as Record<string, string | undefined>
      }
      MenuProps={{
        anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
        transformOrigin: { vertical: 'top', horizontal: 'left' },
        slotProps: { paper: { sx: SELECT_MENU_PAPER_SX } }
      }}
      // The select passes its own `sx` to the input it renders
      sx={{
        ...inputSx(false, false),
        pr: 0,
        '&.Mui-focused': { borderColor: PRIMARY },
        '& .MuiSelect-select': {
          pr: '32px !important',
          py: 0,
          height: 38,
          minHeight: 0,
          lineHeight: '38px',
          fontSize: 14,
          color: TEXT_COLOR,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        },
        '& .ModalSelect-chevron': {
          position: 'absolute',
          right: 8,
          pointerEvents: 'none',
          color: HINT_COLOR,
          display: 'flex'
        }
      }}
    >
      {options.map(option => (
        <MenuItem
          key={option.value}
          value={option.value}
          // Called on each pick: the select calls `onChange` on a change only
          onClick={() => {
            onChange(option.value)
          }}
          sx={SELECT_ITEM_SX}
        >
          <Box
            component="span"
            sx={{
              flex: '1 1 auto',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {option.label}
          </Box>
          {option.value === value ? (
            <Box
              component="span"
              sx={{ display: 'flex', flexShrink: 0, color: PRIMARY }}
            >
              <Icon icon={FilterSelected} size={20} aria-hidden="true" />
            </Box>
          ) : null}
        </MenuItem>
      ))}
    </Select>
  )
}

function SelectChevron(): ReactElement {
  return (
    <span className="ModalSelect-chevron" aria-hidden="true">
      <Icon icon={Dropdown} size={20} />
    </span>
  )
}

export interface ModalFieldIconButtonProps {
  /** Its accessible name and its tooltip */
  label: string
  icon: ComponentProps<typeof Icon>['icon']
  onClick: () => void
  'aria-haspopup'?: 'dialog' | 'menu'
  /** Id of what tells it from its twins, e.g. the label of its field */
  'aria-describedby'?: string
  'data-testid'?: string
}

/**
 * A 40 px square button beside a field of `ModalDialog`, framed as the
 * field (the calendar of tmail-flutter's `DefaultDateDropDownFieldWidget`)
 */
export function ModalFieldIconButton({
  label,
  icon,
  onClick,
  'aria-haspopup': hasPopup,
  'aria-describedby': describedBy,
  'data-testid': testId
}: ModalFieldIconButtonProps): ReactElement {
  return (
    <Tooltip title={label}>
      <IconButton
        aria-label={label}
        aria-haspopup={hasPopup}
        aria-describedby={describedBy}
        onClick={onClick}
        sx={{
          width: 40,
          height: 40,
          p: 0,
          flexShrink: 0,
          border: `1px solid ${FIELD_BORDER}`,
          borderRadius: '10px',
          color: HINT_COLOR,
          bgcolor: TMAIL.surface,
          '&:hover': { bgcolor: TMAIL.hoverOnSurface }
        }}
        data-testid={testId}
      >
        <Icon icon={icon} size={22} />
      </IconButton>
    </Tooltip>
  )
}
