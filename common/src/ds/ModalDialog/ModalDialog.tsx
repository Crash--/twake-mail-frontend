// Upstream to twake-ui: no. A modal for a short task (folder creation, label
// creation, renaming a folder, the recovery form): twake-mui's `Dialog`, the
// close cross at the top end, a subtitle under the title, fields with their
// label above (or at their start), and at the end a text button and the
// confirming one. Its fields are the 40 px outlined fields below, twake-mui
// has no compact field.
import { Icon, Dropdown } from '@linagora/twake-icons'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputBase,
  MenuItem,
  Select,
  Tooltip,
  Typography,
  type InputBaseProps
} from '@linagora/twake-mui'
import {
  forwardRef,
  type ComponentProps,
  type Ref,
  type SubmitEventHandler,
  type ReactElement,
  type ReactNode
} from 'react'

import { CloseDialog, FilterSelected } from '@/ds/FlutterIcons/FlutterIcons'

const SUBTITLE_SX = { m: 0, px: '2rem', pt: 1 } as const

export interface ModalDialogProps {
  open?: boolean
  /** Shown at the top, and the name of the dialog */
  title: ReactNode
  /** The line under the title, e.g. where a new folder goes */
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
  /** `small`: the narrow dialog, as the one renaming a folder */
  size?: 'large' | 'small'
  /** `body`: the subtitle as a paragraph of text, not a caption */
  subtitleLook?: 'caption' | 'body'
  /** Wider or narrower than the size of the dialog, in px */
  width?: number
  'data-testid'?: string
}

/**
 * A modal named by its title; Escape and the cross close it and give the
 * focus back to what opened it. The focus is not kept inside: twake-mui's
 * theme sets `disableEnforceFocus` on every `Dialog` and this one keeps it.
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
  subtitleLook = 'caption',
  width,
  'data-testid': testId
}: ModalDialogProps): ReactElement {
  const content = (
    <>
      <DialogTitle id={titleId} className="dialogTitleWithClose">
        {title}
      </DialogTitle>
      {subtitle === undefined ? null : (
        <Typography
          id={describedBy}
          component="p"
          variant={subtitleLook === 'body' ? 'body1' : 'body2'}
          color={subtitleLook === 'body' ? 'text.primary' : 'text.secondary'}
          sx={SUBTITLE_SX}
        >
          {subtitle}
        </Typography>
      )}
      <DialogContent>{children}</DialogContent>
      {actions === undefined ? (
        <Box sx={{ height: 32, flexShrink: 0 }} />
      ) : (
        <DialogActions>{actions}</DialogActions>
      )}
    </>
  )
  return (
    <Dialog
      size={size === 'small' ? 'small' : 'medium'}
      fullScreen={false}
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      slotProps={{
        paper:
          width === undefined
            ? undefined
            : { sx: { '&&': { maxWidth: width } } },
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
          className="dialogIconButton dialogCloseButton"
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

export interface ModalDialogButtonProps {
  children: ReactNode
  onClick?: () => void
  /** The confirming action: a filled button, else text */
  isMain?: boolean
  /** Submits the form of the dialog */
  type?: 'button' | 'submit'
  disabled?: boolean
  'data-testid'?: string
}

/** A button of `ModalDialog` */
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
      data-testid={testId}
    >
      {children}
    </Button>
  )
}

const LABEL_SX = {
  display: 'block',
  mb: '16px',
  typography: 'subtitle2',
  color: 'text.primary'
} as const

const INLINE_LABEL_SX = {
  width: 112,
  flexShrink: 0,
  minHeight: 40,
  display: 'flex',
  alignItems: 'center',
  typography: 'body1',
  color: 'text.primary'
} as const

export interface ModalFieldProps {
  label: ReactNode
  /** The control the label names */
  htmlFor?: string
  id?: string
  children: ReactNode
  /** Space above, in px: 0 for the first field */
  spaceAbove?: number
  /** The label at the start of the row, 112 px wide (the recovery form) */
  isInline?: boolean
}

/** A field of `ModalDialog`: its label above the control */
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
    borderColor: hasError ? 'error.main' : 'border.main',
    borderRadius: 1,
    bgcolor: 'background.paper',
    typography: 'body1',
    color: 'text.primary',
    '&.Mui-focused': {
      borderColor: hasError ? 'error.main' : 'primary.main'
    },
    '& .MuiInputBase-input': { p: 0, height: 'auto', lineHeight: '18px' },
    '& .MuiInputBase-input::placeholder': {
      color: 'text.secondary',
      opacity: 1
    }
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

/** A text field of `ModalDialog`: 40 px, outlined, primary when focused */
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
            variant="body2"
            color="error"
            sx={{ mt: '8px' }}
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

/** A field opening a choice: its value, a chevron */
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
        border: '1px solid',
        borderColor: 'border.main',
        borderRadius: 1,
        typography: 'body1',
        color: 'text.primary',
        bgcolor: 'background.paper',
        '&:hover': { bgcolor: 'action.hover' },
        '& .ModalSelectButton-icon': { display: 'flex', color: 'primary.main' },
        '& .ModalSelectButton-arrow': {
          display: 'flex',
          color: 'text.icon',
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

const SELECT_MENU_PAPER_SX = {
  mt: '4px',
  maxHeight: 332,
  boxSizing: 'border-box'
} as const

/**
 * A list of choices in a field of `ModalDialog`: the field shows the choice
 * and a chevron, its menu drops under it with a check after the choice (a
 * combobox and its listbox)
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
        '& .MuiSelect-select': {
          pr: '32px !important',
          py: 0,
          height: 38,
          minHeight: 0,
          lineHeight: '38px',
          color: 'text.primary',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        },
        '& .ModalSelect-chevron': {
          position: 'absolute',
          right: 8,
          pointerEvents: 'none',
          color: 'text.icon',
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
              sx={{ display: 'flex', flexShrink: 0, color: 'primary.main' }}
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
 * field (a calendar opening a date)
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
          border: '1px solid',
          borderColor: 'border.main',
          borderRadius: 1,
          color: 'text.icon',
          bgcolor: 'background.paper',
          '&:hover': { bgcolor: 'action.hover' }
        }}
        data-testid={testId}
      >
        <Icon icon={icon} size={22} />
      </IconButton>
    </Tooltip>
  )
}
