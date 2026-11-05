// Upstream to twake-ui: yes, to @linagora/twake-icons, which does not have the
// "More" of a row, three dots one above the other (ic_more_vertical.svg),
// an outline pencil (its `Pen` is filled), the slanted paper clip of the Twake
// Mail design (attachfile2), the empty box of "Select all", nor the outlined
// reply arrow of a row (docs/twake-mui-gaps.md): drawn on the current text
// colour so that `Icon` can size and colour them.
import type { ReactElement, SVGAttributes } from 'react'
import { iconProps } from '@/ds/FlutterIcons/iconColor'

type SvgProps = SVGAttributes<SVGSVGElement>

/** Three dots one above the other, the "More" of a row */
export function MoreVerticalIcon(props: SvgProps): ReactElement {
  return (
    <svg viewBox="0 0 28 28" fill="currentColor" {...iconProps(props)}>
      <path d="M16.25 7C16.25 8.24264 15.2426 9.25 14 9.25C12.7574 9.25 11.75 8.24264 11.75 7C11.75 5.75736 12.7574 4.75 14 4.75C15.2426 4.75 16.25 5.75736 16.25 7ZM16.25 14C16.25 15.2426 15.2426 16.25 14 16.25C12.7574 16.25 11.75 15.2426 11.75 14C11.75 12.7574 12.7574 11.75 14 11.75C15.2426 11.75 16.25 12.7574 16.25 14ZM16.25 21C16.25 22.2426 15.2426 23.25 14 23.25C12.7574 23.25 11.75 22.2426 11.75 21C11.75 19.7574 12.7574 18.75 14 18.75C15.2426 18.75 16.25 19.7574 16.25 21Z" />
    </svg>
  )
}

/**
 * An outline pencil (Material Icons' outlined `edit`, Apache-2.0), cropped
 * to its glyph as twake-icons draw theirs, so that it takes their size
 */
export function EditOutlineIcon(props: SvgProps): ReactElement {
  return (
    <svg viewBox="3 3 18 18" fill="currentColor" {...iconProps(props)}>
      <path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z" />
    </svg>
  )
}

/** A slanted paper clip, the attachment of a row */
export function AttachmentIcon(props: SvgProps): ReactElement {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...iconProps(props)}>
      <path d="M9.7884 8.22649C10.0103 8.00456 10.3702 8.00456 10.5921 8.22649C10.814 8.44843 10.814 8.80826 10.5921 9.03019L8.22119 11.4011C7.89897 11.7233 7.88027 12.2657 8.22119 12.6067C8.56211 12.9476 9.10452 12.9289 9.42674 12.6067L13.8471 8.18631C14.7573 7.2761 14.7075 5.83192 13.8471 4.97151C12.9867 4.1111 11.5425 4.0613 10.6323 4.97151L6.21194 9.39186C4.76236 10.8414 4.78939 13.1934 6.21194 14.6159C7.63449 16.0385 9.9864 16.0655 11.436 14.6159L13.8069 12.245C14.0288 12.0231 14.3887 12.0231 14.6106 12.245C14.8325 12.4669 14.8325 12.8268 14.6106 13.0487L12.2397 15.4196C10.342 17.3172 7.27058 17.2819 5.40824 15.4196C3.5459 13.5573 3.5106 10.4858 5.40824 8.58816L9.82859 4.16781C11.1955 2.80087 13.3584 2.87545 14.6508 4.16781C15.9431 5.46017 16.0177 7.62306 14.6508 8.99001L10.2304 13.4104C9.47627 14.1645 8.21514 14.208 7.41749 13.4104C6.61983 12.6127 6.66332 11.3516 7.41749 10.5974L9.7884 8.22649Z" />
    </svg>
  )
}

/** An empty square box, "Select all" of a list toolbar */
export function CheckboxBlankIcon(props: SvgProps): ReactElement {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" {...iconProps(props)}>
      <path d="M12.6667 3.33333V12.6667H3.33333V3.33333H12.6667ZM12.6667 2H3.33333C2.6 2 2 2.6 2 3.33333V12.6667C2 13.4 2.6 14 3.33333 14H12.6667C13.4 14 14 13.4 14 12.6667V3.33333C14 2.6 13.4 2 12.6667 2Z" />
    </svg>
  )
}

const REPLY_OUTLINE_PATH =
  'M10.0922 3.33768C10.9838 3.40105 11.6875 4.14972 11.6875 5.06397L11.6883 6.7681L11.7046 6.77204C15.3262 7.52788 18 10.7607 18 14.5748C18 14.8519 17.9859 15.128 17.9581 15.4019C17.8918 16.0549 17.0666 16.2895 16.6712 15.7679L16.5219 15.5775C15.3558 14.1395 13.6956 13.1962 11.8589 12.9491L11.6883 12.9284L11.6875 14.9362C11.6875 15.323 11.5587 15.6989 11.3217 16.0036C10.7364 16.7558 9.65653 16.8877 8.90977 16.2981L2.65826 11.3621C2.54939 11.2761 2.45123 11.1772 2.3659 11.0676C1.78061 10.3153 1.9115 9.22747 2.65826 8.63786L8.90977 3.70186C9.21218 3.46309 9.58532 3.33333 9.96955 3.33333L10.0922 3.33768ZM9.96955 4.78224C9.907 4.78224 9.84625 4.80336 9.79702 4.84223L3.54551 9.77823C3.42394 9.87421 3.40264 10.0513 3.49792 10.1738C3.51181 10.1916 3.52779 10.2077 3.54551 10.2217L9.79702 15.1577C9.91859 15.2537 10.0944 15.2322 10.1897 15.1098C10.2282 15.0602 10.2492 14.999 10.2492 14.936L10.25 12.161C10.2501 11.7564 10.5793 11.4302 10.981 11.4369L11.1673 11.44L11.4407 11.4533C13.2578 11.5701 14.9539 12.2479 16.3297 13.3577L16.469 13.4733L16.45 13.3644C15.9364 10.6151 13.7053 8.44986 10.8819 8.10301C10.5212 8.05869 10.2499 7.7502 10.2498 7.38408L10.2492 5.06417C10.2492 4.90837 10.124 4.78224 9.96955 4.78224Z'

/** The outlined arrow of an answered email, drawn like the outlined star */
export function ReplyOutlineIcon(props: SvgProps): ReactElement {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...iconProps(props)}>
      <path d={REPLY_OUTLINE_PATH} />
    </svg>
  )
}

/** The same arrow pointing right, a forwarded email */
export function ForwardOutlineIcon(props: SvgProps): ReactElement {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...iconProps(props)}>
      <path d={REPLY_OUTLINE_PATH} transform="matrix(-1 0 0 1 20 0)" />
    </svg>
  )
}
