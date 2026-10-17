// Upstream to twake-ui: yes, with a PDF viewer shared by Mail, Drive and
// Chat: the layers pdf.js draws over a page (its selectable text, the links)
// need the CSS of its viewer, which the app does not load as a stylesheet.
import { Box } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement, ReactNode, Ref } from 'react'

export interface PdfPageFrameProps {
  /** The page canvas, its text layer and its links */
  children: ReactNode
}

const FRAME_SX = {
  position: 'relative',
  width: 'fit-content',
  maxWidth: '100%',
  mb: 2,
  // `setLayerDimensions` of pdf.js rounds the size of a layer to these
  '--scale-round-x': '1px',
  '--scale-round-y': '1px'
} as const

/** One page of a PDF: the canvas and the layers placed over it */
export function PdfPageFrame({ children }: PdfPageFrameProps): ReactElement {
  return <Box sx={FRAME_SX}>{children}</Box>
}

export interface PdfTextLayerProps {
  /** The container pdf.js `TextLayer` fills, with `--total-scale-factor` */
  ref: Ref<HTMLDivElement>
}

// The `.textLayer` rules of pdf.js `web/pdf_viewer.css` that the preview
// needs: transparent text over the canvas, placed and sized by the custom
// properties pdf.js sets on each run
const TEXT_LAYER_SX = {
  colorScheme: 'only light',
  position: 'absolute',
  textAlign: 'initial',
  inset: 0,
  overflow: 'clip',
  lineHeight: 1,
  letterSpacing: 'normal',
  wordSpacing: 'normal',
  textSizeAdjust: 'none',
  forcedColorAdjust: 'none',
  transformOrigin: '0 0',
  caretColor: 'CanvasText',
  zIndex: 0,
  '--min-font-size': 1,
  '--text-scale-factor':
    'calc(var(--total-scale-factor) * var(--min-font-size))',
  '--min-font-size-inv': 'calc(1 / var(--min-font-size))',
  '& :is(span, br)': {
    color: 'transparent',
    position: 'absolute',
    whiteSpace: 'pre',
    cursor: 'text',
    transformOrigin: '0% 0%',
    userSelect: 'text'
  },
  '& > :not(.markedContent), & .markedContent span:not(.markedContent)': {
    zIndex: 1,
    '--font-height': 0,
    fontSize: 'calc(var(--text-scale-factor) * var(--font-height))',
    '--scale-x': 1,
    '--rotate': '0deg',
    transform:
      'rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv))'
  },
  '& .markedContent': { display: 'contents' },
  '& ::selection': {
    background: 'color-mix(in srgb, AccentColor, transparent 50%)',
    color: 'transparent'
  },
  '& br::selection': { background: 'transparent' }
} as const

/**
 * The selectable (and readable by a screen reader) text of a page, drawn by
 * pdf.js in transparent runs over the canvas
 */
export function PdfTextLayer({ ref }: PdfTextLayerProps): ReactElement {
  return <Box ref={ref} sx={TEXT_LAYER_SX} />
}

export interface PdfLinkAreaProps {
  href: string
  /** The accessible name: the address */
  label: string
  /** Placement, in fractions of the page (0 to 1) */
  left: number
  top: number
  width: number
  height: number
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
  'data-testid'?: string
}

const percent = (fraction: number): string => `${fraction * 100}%`

/**
 * A link of a page: a transparent area over the link the canvas draws,
 * opening in a new tab without the app as opener nor referrer. Above the
 * text layer; the theme draws its focus.
 */
export function PdfLinkArea({
  href,
  label,
  left,
  top,
  width,
  height,
  onClick,
  'data-testid': testId
}: PdfLinkAreaProps): ReactElement {
  return (
    <Box
      component="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      onClick={onClick}
      data-testid={testId}
      sx={{
        position: 'absolute',
        zIndex: 1,
        left: percent(left),
        top: percent(top),
        width: percent(width),
        height: percent(height)
      }}
    />
  )
}
