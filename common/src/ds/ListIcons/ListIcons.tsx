// Upstream to twake-ui: yes, to @linagora/twake-icons, which does not have the
// "More" of a row, three dots one above the other (ic_more_vertical.svg),
// nor an outline pencil (its `Pen` is filled) (docs/twake-mui-gaps.md):
// drawn on the current text colour so that `Icon` can size and colour them.
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
