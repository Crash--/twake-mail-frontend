// Upstream to twake-ui: yes, as field looks. What the dialogs on twake-mui's
// `FixedDialog` still lack: a label above a field or at its start, a field
// opening a choice, and the compact select and calendar button of the advanced
// search.
import { Icon, Dropdown, CheckCircle } from '@linagora/twake-icons'
import {
  Box,
  Button,
  IconButton,
  InputBase,
  MenuItem,
  Select,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import type { ComponentProps, Ref, ReactElement, ReactNode } from 'react'

const LABEL_SX = {
  display: 'block',
  mb: 1,
  typography: 'subtitle2',
  color: 'text.primary'
} as const

const INLINE_LABEL_SX = {
  width: 112,
  flexShrink: 0,
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
          alignItems: 'center',
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

const INPUT_SX = {
  width: '100%',
  minHeight: 40,
  boxSizing: 'border-box',
  px: '12px',
  py: 0,
  alignItems: 'center',
  border: '1px solid',
  borderColor: 'border.main',
  borderRadius: 1,
  bgcolor: 'background.paper',
  typography: 'body1',
  color: 'text.primary',
  '&.Mui-focused': { borderColor: 'primary.main' },
  '& .MuiInputBase-input': { p: 0, height: 'auto', lineHeight: '18px' }
} as const

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
        '& .ModalSelectButton-icon': { display: 'flex', color: 'text.icon' },
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
        ...INPUT_SX,
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
              <Icon icon={CheckCircle} size={20} aria-hidden="true" />
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
