// Upstream to twake-ui: with RichTextEditor.
import { Icon } from '@linagora/twake-icons'
import {
  Box,
  Button,
  InputBase,
  Popover,
  type PopoverPosition
} from '@linagora/twake-mui'
import {
  useId,
  useRef,
  useState,
  type SubmitEvent,
  type ReactElement,
  type SVGAttributes
} from 'react'

import type { RichTextLinkDialogLabels } from './types'

export interface LinkDialogValue {
  text: string
  url: string
}

export interface LinkDialogProps {
  open: boolean
  labels: RichTextLinkDialogLabels
  initialValue: LinkDialogValue
  /** Shows the "remove" action: the selection is in a link */
  canRemove: boolean
  onApply: (value: LinkDialogValue) => void
  onRemove: () => void
  onClose: () => void
  textInputTestId?: string
  urlInputTestId?: string
  applyButtonTestId?: string
}

/** tmail-flutter's `ic_text` */
function TextIcon(props: SVGAttributes<SVGSVGElement>): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M2.57153 5.99997C2.57153 5.52658 2.95529 5.14282 3.42868 5.14282H10.2858C10.7592 5.14282 11.143 5.52658 11.143 5.99997C11.143 6.47335 10.7592 6.85711 10.2858 6.85711L7.71439 6.85711V12.8571C7.71439 13.3305 7.33063 13.7143 6.85725 13.7143C6.38386 13.7143 6.0001 13.3305 6.0001 12.8571V6.85711L3.42868 6.85711C2.95529 6.85711 2.57153 6.47335 2.57153 5.99997Z"
        fill="currentColor"
      />
      <path
        d="M14.5715 6.85711C14.0981 6.85711 13.7144 7.24086 13.7144 7.71425C13.7144 8.18764 14.0981 8.57139 14.5715 8.57139L20.5715 8.57139C21.0449 8.57139 21.4287 8.18764 21.4287 7.71425C21.4287 7.24086 21.0449 6.85711 20.5715 6.85711L14.5715 6.85711Z"
        fill="currentColor"
      />
      <path
        d="M10.2858 12.8571C10.2858 12.3837 10.6696 12 11.143 12L20.5715 12C21.0449 12 21.4287 12.3837 21.4287 12.8571C21.4287 13.3305 21.0449 13.7143 20.5715 13.7143L11.143 13.7143C10.6696 13.7143 10.2858 13.3305 10.2858 12.8571Z"
        fill="currentColor"
      />
      <path
        d="M6.0001 18C6.0001 17.5266 6.38386 17.1428 6.85725 17.1428L20.5715 17.1428C21.0449 17.1428 21.4287 17.5266 21.4287 18C21.4287 18.4734 21.0449 18.8571 20.5715 18.8571L6.85725 18.8571C6.38386 18.8571 6.0001 18.4734 6.0001 18Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** tmail-flutter's `ic_insert_link` */
function LinkIcon(props: SVGAttributes<SVGSVGElement>): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M10.7914 14.4256C10.4572 14.7599 9.90859 14.7599 9.5743 14.4256C7.90287 12.7542 7.90287 10.037 9.5743 8.36561L14.0657 3.87418C15.7372 2.20275 18.4543 2.20275 20.1257 3.87418C21.7972 5.54561 21.7972 8.26275 20.1257 9.93418L18.8949 11.165C18.561 11.4989 18.0197 11.4994 17.6852 11.166C17.3508 10.8327 17.3498 10.2915 17.6828 9.95696L18.9086 8.72561C19.92 7.72275 19.92 6.09418 18.9086 5.09132C17.9057 4.07989 16.2772 4.07989 15.2743 5.09132L10.7914 9.57418C9.78001 10.577 9.78001 12.2056 10.7914 13.2085C11.1429 13.5427 11.1429 14.0913 10.7914 14.4256ZM13.2086 9.57418C13.5429 9.23989 14.0914 9.23989 14.4257 9.57418C16.0972 11.2456 16.0972 13.9627 14.4257 15.6342L9.9343 20.1256C8.26287 21.797 5.54573 21.797 3.8743 20.1256C2.20287 18.4542 2.20287 15.737 3.8743 14.0656L5.10128 12.8386C5.43566 12.5035 5.97837 12.5035 6.31311 12.8383L6.31378 12.8397C6.64783 13.1748 6.64767 13.7172 6.31343 14.0522L5.09144 15.2742C4.08001 16.277 4.08001 17.9056 5.09144 18.9085C6.0943 19.9199 7.72287 19.9199 8.72573 18.9085L13.2086 14.4256C14.22 13.4227 14.22 11.7942 13.2086 10.7913C12.8572 10.457 12.8572 9.90846 13.2086 9.57418Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** `AppColor.m3Neutral90` */
const BORDER = '#E6E1E5'
const PRIMARY = '#0A84FF'

const PAPER_SX = {
  borderRadius: '10px',
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.12), 0 0 2px rgba(0, 0, 0, 0.12)',
  pl: '16px',
  pr: '12px',
  py: '16px'
} as const

const ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  color: '#55687D'
} as const

const INPUT_SX = {
  width: 286,
  maxWidth: 'calc(100vw - 140px)',
  height: 40,
  px: '12px',
  boxSizing: 'border-box',
  border: `1px solid ${BORDER}`,
  borderRadius: '10px',
  fontSize: 14,
  lineHeight: '18px',
  color: '#222222',
  '&.Mui-focused': { borderColor: PRIMARY },
  '& .MuiInputBase-input': { p: 0 },
  '& .MuiInputBase-input::placeholder': { color: '#818C99', opacity: 1 }
} as const

const TEXT_BUTTON_SX = {
  minWidth: 0,
  px: '8px',
  textTransform: 'none',
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '20px',
  letterSpacing: '0.1px',
  color: PRIMARY,
  bgcolor: 'transparent',
  boxShadow: 'none',
  '&.Mui-disabled': { color: '#939393' }
} as const

/** Where the caret is: the card opens under it, as tmail-flutter's */
function caretPosition(): PopoverPosition | null {
  const selection = window.getSelection()
  if (selection === null || selection.rangeCount === 0) return null
  const rect = selection.getRangeAt(0).getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0 && rect.top === 0) return null
  return { top: rect.bottom + 8, left: rect.left }
}

/**
 * Text and URL of a link, as tmail-flutter's link card
 * (`LinkEditDialogOverlayOptions`): under the caret, the text with its icon,
 * then the URL with its icon and "Apply", enabled once the URL is not blank;
 * Enter in the text goes to the URL, Escape closes it. A named dialog that
 * keeps the focus while open.
 */
export function LinkDialog({
  open,
  labels,
  initialValue,
  canRemove,
  onApply,
  onRemove,
  onClose,
  textInputTestId,
  urlInputTestId,
  applyButtonTestId
}: LinkDialogProps): ReactElement {
  const titleId = useId()
  const urlRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(initialValue.text)
  const [url, setUrl] = useState(initialValue.url)
  const [opened, setOpened] = useState(open)
  const [position, setPosition] = useState<PopoverPosition | null>(null)
  // Reset the fields at each opening (state derived from props)
  if (open !== opened) {
    setOpened(open)
    if (open) {
      setText(initialValue.text)
      setUrl(initialValue.url)
      setPosition(caretPosition())
    }
  }

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (url.trim() === '') return
    onApply({ text: text.trim(), url: url.trim() })
  }

  return (
    <Popover
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={
        position ?? {
          top: window.innerHeight / 3,
          left: Math.max(16, window.innerWidth / 2 - 180)
        }
      }
      // The editor gets the focus back itself once the link is applied
      disableRestoreFocus
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-labelledby': titleId,
          sx: PAPER_SX
        },
        // Once in place: a menu closing at the same time would take it back
        transition: { onEntered: () => urlRef.current?.focus() }
      }}
    >
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <span id={titleId} className="u-visuallyhidden">
          {labels.title}
        </span>
        <Box sx={ROW_SX}>
          <Icon icon={TextIcon} size={24} aria-hidden="true" />
          <InputBase
            value={text}
            onChange={event => {
              setText(event.target.value)
            }}
            placeholder={labels.text}
            inputProps={{
              'aria-label': labels.text,
              'data-testid': textInputTestId
            }}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                urlRef.current?.focus()
              }
            }}
            sx={INPUT_SX}
          />
        </Box>
        <Box sx={{ ...ROW_SX, mt: '8px' }}>
          <Icon icon={LinkIcon} size={24} aria-hidden="true" />
          <InputBase
            value={url}
            onChange={event => {
              setUrl(event.target.value)
            }}
            type="url"
            required
            placeholder={labels.url}
            inputRef={urlRef}
            inputProps={{
              'aria-label': labels.url,
              'data-testid': urlInputTestId
            }}
            sx={INPUT_SX}
          />
          <Button
            type="submit"
            variant="text"
            disabled={url.trim() === ''}
            sx={TEXT_BUTTON_SX}
            data-testid={applyButtonTestId}
          >
            {labels.apply}
          </Button>
          {canRemove ? (
            <Button
              variant="text"
              onClick={onRemove}
              sx={{ ...TEXT_BUTTON_SX, color: '#FF3347' }}
            >
              {labels.remove}
            </Button>
          ) : null}
        </Box>
      </Box>
    </Popover>
  )
}
