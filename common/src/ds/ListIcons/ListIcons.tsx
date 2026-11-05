// Upstream to twake-ui: yes, to @linagora/twake-icons, which does not have the
// "More" of a row, three dots one above the other (ic_more_vertical.svg),
// an outline pencil (its `Pen` is filled), the slanted paper clip of the Twake
// Mail design (attachfile2) nor the empty box of "Select all"
// (docs/twake-mui-gaps.md): drawn on the current text colour so that `Icon`
// can size and colour them.
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
