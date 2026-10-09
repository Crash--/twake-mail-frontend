// Upstream to twake-ui: no, the look of tmail-flutter's form dialogs of the
// settings (`RuleFilterCreatorView`): 612 px wide and at most 674 px high,
// rounded by 16 px, the title centred in Semi Bold 24 with a close cross at
// the top end, the fields 32 px in, and at the end "Cancel" in blue text
// and the confirming 48 px blue pill. A phone gets the whole screen: an
// arrow back and the title in the middle of a 64 px bar. Its parts: the
// labels of the fields (Semi Bold 14 black), the light grey boxes holding
// a condition or an action, the outlined blue pills adding one ("Add a
// condition"), the native selects and the field buttons (a folder) drawn
// as tmail-flutter's 40 px dropdowns.
import { Icon, type IconProps } from '@linagora/twake-icons'
import {
  Box,
  ButtonBase,
  Dialog,
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

import {
  ArrowBack,
  CloseDialog,
  Dropdown
} from '@/ds/FlutterIcons/FlutterIcons'
import { TMAIL } from '@/ds/TmailColors/tmailColors'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

const PRIMARY = TMAIL.primary
// The confirming pill keeps its blue, under its white label
const PRIMARY_FILL = '#007AFF'

const PAPER_SX = {
  width: 612,
  // Over the 544 px of twake-mui's `medium` dialog
  '&&': { maxWidth: 'calc(100% - 32px)' },
  // As tmail-flutter: as tall as it may be, the fields scrolling inside
  height: 'min(calc(100dvh - 100px), 674px)',
  maxHeight: 'none',
  m: 2,
  borderRadius: '16px',
  boxShadow: '0 2px 24px rgba(0, 0, 0, 0.08), 0 0 2px rgba(0, 0, 0, 0.08)',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
} as const

const TITLE_SX = {
  flexShrink: 0,
  m: 0,
  pt: 3,
  pb: 2,
  px: 7,
  textAlign: 'center',
  fontSize: 24,
  fontWeight: 600,
  lineHeight: '32px',
  color: TMAIL.textOnSurface
} as const

const PHONE_BAR_SX = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  height: 64,
  pl: 1,
  pr: 2
} as const

const PHONE_TITLE_SX = {
  flex: '1 1 auto',
  minWidth: 0,
  m: 0,
  mr: 5,
  textAlign: 'center',
  fontSize: 16,
  fontWeight: 400,
  lineHeight: '24px',
  color: TMAIL.textOnSurface
} as const

const CLOSE_SX = {
  position: 'absolute',
  top: 4,
  right: 4,
  p: '10px',
  color: TMAIL.steelLight
} as const

function bodySx(isPhone: boolean): Record<string, unknown> {
  return {
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
    px: isPhone ? 2 : 4
  }
}

function footerSx(isPhone: boolean): Record<string, unknown> {
  return {
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 1,
    py: '25px',
    px: isPhone ? 2 : 4
  }
}

const TEXT_BUTTON_SX = {
  minWidth: 67,
  height: 48,
  px: '10px',
  borderRadius: '100px',
  color: PRIMARY,
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '20px',
  letterSpacing: '0.1px',
  '&:hover': { bgcolor: TMAIL.blueHover },
  '&.Mui-disabled': { opacity: 0.38 }
} as const

const MAIN_BUTTON_SX = {
  ...TEXT_BUTTON_SX,
  minWidth: 143,
  px: 3,
  color: '#FFFFFF',
  bgcolor: PRIMARY_FILL,
  '&:hover': { bgcolor: '#0062CC' }
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

/** A form of the settings in a dialog, as tmail-flutter's rule creator */
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
      fullScreen={isPhone}
      // Its own width: not the 600 px of MUI's `sm`
      maxWidth={false}
      aria-labelledby={titleId}
      slotProps={{ paper: { sx: isPhone ? { display: 'flex' } : PAPER_SX } }}
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
          <Box sx={PHONE_BAR_SX}>
            <Tooltip title={labels.back}>
              <IconButton
                aria-label={labels.back}
                onClick={handleClose}
                sx={{ color: TMAIL.textOnSurface }}
              >
                <Icon icon={ArrowBack} size={24} />
              </IconButton>
            </Tooltip>
            <Typography id={titleId} component="h2" sx={PHONE_TITLE_SX}>
              {title}
            </Typography>
          </Box>
        ) : (
          <Typography id={titleId} component="h2" sx={TITLE_SX}>
            {title}
          </Typography>
        )}
        <Box sx={bodySx(isPhone)}>{children}</Box>
        <Box sx={footerSx(isPhone)}>
          <ButtonBase
            onClick={onClose}
            disabled={isBusy}
            sx={TEXT_BUTTON_SX}
            data-testid={cancelTestId}
          >
            {labels.cancel}
          </ButtonBase>
          <ButtonBase
            type="submit"
            disabled={isBusy}
            sx={MAIN_BUTTON_SX}
            data-testid={submitTestId}
          >
            {labels.submit}
          </ButtonBase>
        </Box>
        {isPhone ? null : (
          <IconButton
            aria-label={labels.close}
            onClick={handleClose}
            sx={CLOSE_SX}
          >
            <Icon icon={CloseDialog} size={24} />
          </IconButton>
        )}
      </Box>
    </Dialog>
  )
}

const LABEL_SX = {
  display: 'block',
  m: 0,
  fontSize: 14,
  fontWeight: 600,
  lineHeight: '18px',
  color: TMAIL.textBlack
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
  bgcolor: TMAIL.fillF9
} as const

export interface SettingsFormBoxProps {
  /** Names the group, e.g. "Condition 1" */
  label: string
  /** `action`: 72 px high; a condition fits its fields (64) */
  kind?: 'condition' | 'action'
  children: ReactNode
  'data-testid'?: string
}

/** A light grey box holding a condition or an action, in a row */
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

/** The fields of a box one under the other, as tmail-flutter on a phone */
export function SettingsFormStack({
  isStacked,
  children
}: SettingsFormStackProps): ReactElement {
  return (
    <Box sx={isStacked ? STACK_SX : { display: 'contents' }}>{children}</Box>
  )
}

const TEXT_SX = {
  fontSize: 14,
  fontWeight: 400,
  lineHeight: '18px',
  color: TMAIL.textBlack
} as const

export interface SettingsFormTextProps {
  children: ReactNode
  className?: string
}

/** A text between the fields ("If", "of the following…"): Regular 14 */
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

const OUTLINED_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1,
  minWidth: 161,
  height: 36,
  px: 2,
  borderRadius: '100px',
  border: `1px solid ${PRIMARY}`,
  bgcolor: TMAIL.surface,
  color: PRIMARY,
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '20px',
  letterSpacing: '0.1px',
  '&:hover': { bgcolor: TMAIL.blueHover }
} as const

export interface SettingsOutlinedButtonProps {
  label: string
  icon: IconProps['icon']
  onClick: () => void
  className?: string
  'data-testid'?: string
}

/** An outlined blue pill adding a row, e.g. "Add a condition" */
export function SettingsOutlinedButton({
  label,
  icon,
  onClick,
  className,
  'data-testid': testId
}: SettingsOutlinedButtonProps): ReactElement {
  return (
    <ButtonBase
      onClick={onClick}
      className={className}
      sx={OUTLINED_SX}
      data-testid={testId}
    >
      <Icon icon={icon} size={14} aria-hidden="true" />
      {label}
    </ButtonBase>
  )
}

const FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    height: 40,
    borderRadius: '10px',
    bgcolor: TMAIL.surface,
    fontSize: 14,
    lineHeight: '20px',
    color: TMAIL.textBlack,
    '& fieldset': { borderColor: TMAIL.outline },
    '&:hover fieldset': { borderColor: TMAIL.outlineHover },
    '&.Mui-focused fieldset': { borderColor: PRIMARY, borderWidth: 1 },
    '&.Mui-error fieldset': { borderColor: TMAIL.error }
  },
  '& .MuiOutlinedInput-input': {
    pl: '12px',
    '&::placeholder': { color: TMAIL.grey, opacity: 1 }
  },
  '& .MuiNativeSelect-icon, & .MuiSelect-icon': { color: TMAIL.grey },
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

/** A native select of the dialog, as tmail-flutter's 40 px dropdowns */
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

/** tmail-flutter's thin chevron of its dropdowns, where MUI draws its own */
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

const PREVIEW_TOGGLE_SX = {
  gap: '4px',
  py: '5px',
  px: 1,
  borderRadius: '100px',
  color: PRIMARY,
  fontSize: 11,
  fontWeight: 500,
  lineHeight: '16px',
  '&:hover': { bgcolor: TMAIL.blueHover }
} as const

export interface SettingsPreviewToggleProps {
  label: string
  isOn: boolean
  /** Eye shown while it is off, crossed eye while it is on */
  icons: { on: IconProps['icon']; off: IconProps['icon'] }
  onToggle: () => void
  'data-testid'?: string
}

/** The small blue "Preview" toggle at the end of a label */
export function SettingsPreviewToggle({
  label,
  isOn,
  icons,
  onToggle,
  'data-testid': testId
}: SettingsPreviewToggleProps): ReactElement {
  return (
    <ButtonBase
      aria-pressed={isOn}
      onClick={onToggle}
      sx={PREVIEW_TOGGLE_SX}
      data-testid={testId}
    >
      <Icon icon={isOn ? icons.on : icons.off} size={12} aria-hidden="true" />
      {label}
    </ButtonBase>
  )
}

function bannerSx(isAction: boolean): Record<string, unknown> {
  const color = isAction ? '#166534' : '#0157AD'
  return {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 1,
    p: '4px',
    borderRadius: '8px',
    border: `1px solid ${isAction ? '#BBF7D0' : '#BFDBFE'}`,
    bgcolor: isAction ? '#F0FDF4' : '#EFF6FF',
    color,
    fontSize: 14,
    lineHeight: '20px',
    letterSpacing: '0.1px',
    '& strong': { fontWeight: 700 }
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

/** What a rule will do, in words, as tmail-flutter's `RulePreviewBanner` */
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
  inputTestId?: string
}

/** A text field of the dialog: 40 px high, rounded by 10 px */
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
        htmlInput: { 'aria-label': label, 'data-testid': inputTestId }
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
  borderRadius: '10px',
  border: `1px solid ${TMAIL.outline}`,
  bgcolor: TMAIL.surface,
  fontSize: 14,
  lineHeight: '20px',
  textAlign: 'start',
  '&:hover': { borderColor: TMAIL.outlineHover }
} as const

export interface SettingsFormFieldButtonProps {
  /** What is chosen, null for none (the hint shows) */
  value: string | null
  hint: string
  /** Its accessible name */
  label: string
  onClick: () => void
  hasError?: boolean
  'data-testid'?: string
}

/** A field opening a picker (a folder), drawn as the selects beside it */
export function SettingsFormFieldButton({
  value,
  hint,
  label,
  onClick,
  hasError = false,
  'data-testid': testId
}: SettingsFormFieldButtonProps): ReactElement {
  return (
    <ButtonBase
      onClick={onClick}
      aria-label={value === null ? label : `${label}: ${value}`}
      sx={{
        ...FIELD_BUTTON_SX,
        color: value === null ? TMAIL.grey757 : TMAIL.textBlack,
        ...(hasError ? { borderColor: TMAIL.error } : {})
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
      <Box component="span" sx={{ display: 'flex', color: TMAIL.grey }}>
        <Icon icon={Dropdown} size={16} aria-hidden="true" />
      </Box>
    </ButtonBase>
  )
}
