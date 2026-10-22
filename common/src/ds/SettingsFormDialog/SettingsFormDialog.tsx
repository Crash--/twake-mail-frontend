// Upstream to twake-ui: no. The form dialogs of the settings (the rule
// creator): twake-mui's `Dialog` at most 674 px high, the title with a close
// cross at the top end, the fields scrolling inside, and at the end "Cancel"
// and the confirming button. A phone gets the whole screen, an arrow back
// before the title. Its parts: the labels of the fields, the boxes holding a
// condition or an action, the outlined buttons adding one ("Add a
// condition"), the native selects and the field buttons (a folder).
import { Icon, type IconProps, Dropdown } from '@linagora/twake-icons'
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import type {
  ChangeEvent,
  ReactElement,
  ReactNode,
  Ref,
  SubmitEvent
} from 'react'

import { ArrowBack, CloseDialog } from '@/ds/FlutterIcons/FlutterIcons'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

const PAPER_SX = {
  // As tall as it may be, the fields scrolling inside
  height: 'min(calc(100dvh - 100px), 674px)',
  maxHeight: 'none',
  overflow: 'hidden'
} as const

export interface SettingsFormDialogProps {
  title: string
  titleId: string
  onClose: () => void
  onSubmit: (event: SubmitEvent) => void
  /** While saving: the dialog stays and its buttons wait */
  isBusy?: boolean
  labels: {
    close: string
    /** The arrow back of a phone */
    back: string
    cancel: string
    submit: string
  }
  children: ReactNode
  'data-testid'?: string
  submitTestId?: string
  cancelTestId?: string
}

/** A form of the settings in a dialog */
export function SettingsFormDialog({
  title,
  titleId,
  onClose,
  onSubmit,
  isBusy = false,
  labels,
  children,
  'data-testid': testId,
  submitTestId,
  cancelTestId
}: SettingsFormDialogProps): ReactElement {
  const isPhone = useScreenSize() === 'mobile'
  const handleClose = isBusy ? undefined : onClose

  return (
    <Dialog
      open
      onClose={handleClose}
      size="medium"
      fullScreen={isPhone}
      aria-labelledby={titleId}
      slotProps={{ paper: { sx: isPhone ? undefined : PAPER_SX } }}
      data-testid={testId}
    >
      <Box
        component="form"
        onSubmit={onSubmit}
        noValidate
        className="u-flex u-flex-column u-h-100"
        sx={{ minHeight: 0 }}
      >
        {isPhone ? (
          <>
            <Tooltip title={labels.back}>
              <IconButton
                aria-label={labels.back}
                onClick={handleClose}
                className="dialogIconButton dialogBackButton"
              >
                <Icon icon={ArrowBack} size={24} />
              </IconButton>
            </Tooltip>
            <DialogTitle id={titleId} className="dialogTitleWithBack">
              {title}
            </DialogTitle>
          </>
        ) : (
          <>
            <DialogTitle id={titleId} className="dialogTitleWithClose">
              {title}
            </DialogTitle>
            <IconButton
              aria-label={labels.close}
              onClick={handleClose}
              className="dialogIconButton dialogCloseButton"
            >
              <Icon icon={CloseDialog} size={24} />
            </IconButton>
          </>
        )}
        <DialogContent sx={{ flex: '1 1 auto', minHeight: 0 }}>
          {children}
        </DialogContent>
        <DialogActions>
          <Button
            variant="text"
            onClick={onClose}
            disabled={isBusy}
            data-testid={cancelTestId}
          >
            {labels.cancel}
          </Button>
          <Button type="submit" disabled={isBusy} data-testid={submitTestId}>
            {labels.submit}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}

const LABEL_SX = {
  display: 'block',
  m: 0,
  typography: 'subtitle2',
  color: 'text.primary'
} as const

export interface SettingsFormLabelProps {
  children: ReactNode
  /** The field it names, for a `label` */
  htmlFor?: string
  /** `legend` of a fieldset, `h3`, … */
  component?: 'label' | 'legend' | 'h3' | 'span'
  className?: string
  id?: string
}

/** The label of a field or a group of the dialog */
export function SettingsFormLabel({
  children,
  htmlFor,
  component = 'label',
  className,
  id
}: SettingsFormLabelProps): ReactElement {
  return (
    <Box
      component={component}
      htmlFor={htmlFor}
      id={id}
      className={className}
      sx={LABEL_SX}
    >
      {children}
    </Box>
  )
}

const BOX_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  minHeight: 72,
  mt: 1,
  py: '12px',
  pl: '12px',
  borderRadius: '10px',
  bgcolor: 'background.default'
} as const

export interface SettingsFormBoxProps {
  /** Names the group, e.g. "Condition 1" */
  label: string
  /** `action`: 72 px high; a condition fits its fields (64) */
  kind?: 'condition' | 'action'
  children: ReactNode
  'data-testid'?: string
}

/** A box holding a condition or an action, in a row */
export function SettingsFormBox({
  label,
  kind = 'condition',
  children,
  'data-testid': testId
}: SettingsFormBoxProps): ReactElement {
  return (
    <Box
      role="group"
      aria-label={label}
      sx={kind === 'action' ? BOX_SX : { ...BOX_SX, minHeight: 64 }}
      data-testid={testId}
    >
      {children}
    </Box>
  )
}

const STACK_SX = {
  flex: '1 1 auto',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 1
} as const

export interface SettingsFormStackProps {
  /** One under the other; else they stay in the row of the box */
  isStacked: boolean
  children: ReactNode
}

/** The fields of a box one under the other, on a phone */
export function SettingsFormStack({
  isStacked,
  children
}: SettingsFormStackProps): ReactElement {
  return (
    <Box sx={isStacked ? STACK_SX : { display: 'contents' }}>{children}</Box>
  )
}

const TEXT_SX = { typography: 'body1', color: 'text.primary' } as const

export interface SettingsFormTextProps {
  children: ReactNode
  className?: string
}

/** A text between the fields ("If", "of the following…") */
export function SettingsFormText({
  children,
  className
}: SettingsFormTextProps): ReactElement {
  return (
    <Box component="span" className={className} sx={TEXT_SX}>
      {children}
    </Box>
  )
}

export interface SettingsOutlinedButtonProps {
  label: string
  icon: IconProps['icon']
  onClick: () => void
  className?: string
  'data-testid'?: string
}

/** An outlined button adding a row, e.g. "Add a condition" */
export function SettingsOutlinedButton({
  label,
  icon,
  onClick,
  className,
  'data-testid': testId
}: SettingsOutlinedButtonProps): ReactElement {
  return (
    <Button
      variant="outlined"
      size="small"
      onClick={onClick}
      className={className}
      startIcon={<Icon icon={icon} size={14} aria-hidden="true" />}
      data-testid={testId}
    >
      {label}
    </Button>
  )
}

const FIELD_SX = {
  '& .MuiOutlinedInput-root': { height: 40 },
  '& .MuiOutlinedInput-input': { pl: '12px' },
  '& .MuiNativeSelect-icon, & .MuiSelect-icon': { color: 'text.icon' },
  '& .MuiFormHelperText-root': { mx: 0 }
} as const

export interface SettingsFormSelectProps {
  /** Its accessible name: the select shows no label */
  label: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  /** The `option` elements */
  children: ReactNode
  /** In px; by default it shares the row with the fields beside it */
  width?: number
  inputTestId?: string
}

/** A native select of the dialog, a 40 px dropdown */
export function SettingsFormSelect({
  label,
  value,
  onChange,
  children,
  width,
  inputTestId
}: SettingsFormSelectProps): ReactElement {
  return (
    <TextField
      select
      value={value}
      onChange={onChange}
      sx={
        width === undefined
          ? { ...FIELD_SX, flex: '1 1 0', minWidth: 0 }
          : { ...FIELD_SX, width, flexShrink: 0 }
      }
      slotProps={{
        select: { native: true, IconComponent: SelectChevron },
        htmlInput: { 'aria-label': label, 'data-testid': inputTestId }
      }}
    >
      {children}
    </TextField>
  )
}

/** A thin chevron, where MUI draws its own */
function SelectChevron({ className }: { className?: string }): ReactElement {
  return (
    <Box
      component="span"
      className={className}
      aria-hidden="true"
      sx={{
        display: 'flex',
        '&&': { right: '10px', top: '50%', transform: 'translateY(-50%)' }
      }}
    >
      <Icon icon={Dropdown} size={20} />
    </Box>
  )
}

export interface SettingsPreviewToggleProps {
  label: string
  isOn: boolean
  /** Eye shown while it is off, crossed eye while it is on */
  icons: { on: IconProps['icon']; off: IconProps['icon'] }
  onToggle: () => void
  'data-testid'?: string
}

/** The small "Preview" toggle at the end of a label */
export function SettingsPreviewToggle({
  label,
  isOn,
  icons,
  onToggle,
  'data-testid': testId
}: SettingsPreviewToggleProps): ReactElement {
  return (
    <Button
      variant="text"
      size="small"
      aria-pressed={isOn}
      onClick={onToggle}
      startIcon={
        <Icon icon={isOn ? icons.on : icons.off} size={12} aria-hidden="true" />
      }
      data-testid={testId}
    >
      {label}
    </Button>
  )
}

function bannerSx(isAction: boolean): Record<string, unknown> {
  const tone = isAction ? 'success' : 'info'
  return {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 1,
    p: '4px',
    borderRadius: '8px',
    border: '1px solid',
    borderColor: `${tone}.main`,
    bgcolor: `${tone}.light`,
    color: `${tone}.dark`,
    typography: 'body1',
    '& strong': { fontWeight: 600 }
  }
}

export interface SettingsPreviewBannerProps {
  /** `action`: green with a check; else blue with an information */
  kind: 'condition' | 'action'
  icon: IconProps['icon']
  /** In bold first, e.g. "Preview:" */
  title: string
  message: string
  className?: string
  'data-testid'?: string
}

/** What a rule will do, in words */
export function SettingsPreviewBanner({
  kind,
  icon,
  title,
  message,
  className,
  'data-testid': testId
}: SettingsPreviewBannerProps): ReactElement {
  return (
    <Box
      className={className}
      sx={bannerSx(kind === 'action')}
      data-testid={testId}
    >
      <Icon icon={icon} size={20} aria-hidden="true" />
      <span>
        <strong>{title}</strong> {message}
      </span>
    </Box>
  )
}

export interface SettingsFormTextFieldProps {
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  /** Its accessible name, unless a `SettingsFormLabel` names it by `id` */
  label?: string
  id?: string
  inputRef?: Ref<HTMLInputElement>
  autoFocus?: boolean
  required?: boolean
  error?: boolean
  helperText?: string
  /** Shares the row with the fields beside it rather than its width */
  isInRow?: boolean
  /** The virtual keyboard to show, `email` for addresses */
  inputMode?: 'text' | 'email'
  inputTestId?: string
}

/** A text field of the dialog: 40 px high */
export function SettingsFormTextField({
  value,
  onChange,
  placeholder,
  label,
  id,
  inputRef,
  autoFocus,
  required,
  error = false,
  helperText,
  isInRow = false,
  inputMode,
  inputTestId
}: SettingsFormTextFieldProps): ReactElement {
  return (
    <TextField
      id={id}
      inputRef={inputRef}
      autoFocus={autoFocus}
      required={required}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      error={error}
      helperText={helperText}
      fullWidth={!isInRow}
      sx={isInRow ? { ...FIELD_SX, flex: '1 1 0', minWidth: 0 } : FIELD_SX}
      slotProps={{
        htmlInput: {
          'aria-label': label,
          inputMode,
          'data-testid': inputTestId
        }
      }}
    />
  )
}

const FIELD_BUTTON_SX = {
  flex: '1 1 0',
  minWidth: 0,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 1,
  height: 40,
  pl: '12px',
  pr: '10px',
  borderRadius: 1,
  border: '1px solid',
  borderColor: 'border.main',
  bgcolor: 'background.paper',
  typography: 'body1',
  textAlign: 'start',
  '&:hover': { borderColor: 'text.primary' }
} as const

export interface SettingsFormFieldButtonProps {
  /** What is chosen, null for none (the hint shows) */
  value: string | null
  hint: string
  /** Its accessible name */
  label: string
  onClick: () => void
  /**
   * What is wrong with it, written in red under it and tied to it
   * (`aria-describedby`, `aria-invalid`); null for nothing
   */
  error?: string | null
  /** The id of the error text, when there is one */
  errorId?: string
  buttonRef?: Ref<HTMLButtonElement>
  'data-testid'?: string
}

/** A field opening a picker (a folder), drawn as the selects beside it */
export function SettingsFormFieldButton({
  value,
  hint,
  label,
  onClick,
  error = null,
  errorId,
  buttonRef,
  'data-testid': testId
}: SettingsFormFieldButtonProps): ReactElement {
  const hasError = error !== null
  // Always in the same box, the error under the field, so that the button
  // keeps the focus when the error shows
  return (
    <Box
      sx={{
        flex: '1 1 0',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <ButtonBase
        ref={buttonRef}
        onClick={onClick}
        aria-label={value === null ? label : `${label}: ${value}`}
        aria-invalid={hasError ? true : undefined}
        aria-describedby={hasError ? errorId : undefined}
        sx={{
          ...FIELD_BUTTON_SX,
          flex: 'none',
          width: '100%',
          color: value === null ? 'text.secondary' : 'text.primary',
          ...(hasError ? { borderColor: 'error.main' } : {})
        }}
        data-testid={testId}
      >
        <Box
          component="span"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {value ?? hint}
        </Box>
        <Box component="span" sx={{ display: 'flex', color: 'text.icon' }}>
          <Icon icon={Dropdown} size={16} aria-hidden="true" />
        </Box>
      </ButtonBase>
      {hasError ? (
        <Typography
          id={errorId}
          variant="caption"
          sx={{ color: 'error.main', mt: '3px', mx: '14px' }}
        >
          {error}
        </Typography>
      ) : null}
    </Box>
  )
}
