// Upstream to twake-ui: yes, to @linagora/twake-icons, which has no text
// formatting icon (docs/twake-mui-gaps.md). The icons twake-icons has come
// from it; the others are paths from Material Icons (@mui/icons-material,
// MIT; Google Material Icons, Apache-2.0), drawn with the MUI SvgIcon.
import {
  Dash,
  Icon,
  Image,
  Link,
  List,
  Number as NumberIcon,
  Plus,
  Trash,
  type IconProps
} from '@linagora/twake-icons'
import { SvgIcon, type SvgIconProps } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

export type EditorIconName =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'bulletList'
  | 'orderedList'
  | 'blockquote'
  | 'link'
  | 'textColor'
  | 'highlight'
  | 'indent'
  | 'outdent'
  | 'emoji'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'alignJustify'
  | 'fontSize'
  | 'clearFormatting'
  | 'undo'
  | 'redo'
  | 'image'
  | 'zoomIn'
  | 'zoomOut'
  | 'delete'

/** The icons twake-icons has */
const TWAKE_ICONS: Partial<Record<EditorIconName, IconProps['icon']>> = {
  bulletList: List,
  orderedList: NumberIcon,
  link: Link,
  image: Image,
  zoomIn: Plus,
  zoomOut: Dash,
  delete: Trash
}

/** Material Icons paths of the others */
const PATHS: Partial<Record<EditorIconName, string>> = {
  bold: 'M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42M10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5',
  italic: 'M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z',
  underline:
    'M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6m-7 2v2h14v-2z',
  strike: 'M10 19h4v-3h-4zM5 4v3h5v3h4V7h5V4zM3 14h18v-2H3z',
  blockquote: 'M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z',
  textColor:
    'M5.49 17h2.42l1.27-3.58h5.65L16.09 17h2.42L13.25 3h-2.5zm4.42-5.61 2.03-5.79h.12l2.03 5.79z',
  alignLeft:
    'M15 15H3v2h12zm0-8H3v2h12zM3 13h18v-2H3zm0 8h18v-2H3zM3 3v2h18V3z',
  alignCenter:
    'M7 15v2h10v-2zm-4 6h18v-2H3zm0-8h18v-2H3zm4-6v2h10V7zM3 3v2h18V3z',
  alignRight:
    'M3 21h18v-2H3zm6-4h12v-2H9zm-6-4h18v-2H3zm6-4h12V7H9zM3 3v2h18V3z',
  alignJustify:
    'M3 21h18v-2H3zm0-4h18v-2H3zm0-4h18v-2H3zm0-4h18V7H3zm0-6v2h18V3z',
  highlight:
    'M22 24H2v-4h20zM13.06 5.19l3.75 3.75L7.75 18H4v-3.75zm4.82.87-3.75-3.75 1.83-1.83c.39-.39 1.02-.39 1.41 0l2.34 2.34c.39.39.39 1.02 0 1.41z',
  indent:
    'M3 21h18v-2H3zM3 8v8l4-4zm8 9h10v-2H11zM3 3v2h18V3zm8 6h10V7H11zm0 4h10v-2H11z',
  outdent:
    'M11 17h10v-2H11zM3 12l4 4V8zm0 9h18v-2H3zM3 3v2h18V3zm8 6h10V7H11zm0 4h10v-2H11z',
  emoji:
    'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2M12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8m3.5-10c.83 0 1.5-.67 1.5-1.5S16.33 7 15.5 7 14 7.67 14 8.5s.67 1.5 1.5 1.5m-7 0c.83 0 1.5-.67 1.5-1.5S9.33 7 8.5 7 7 7.67 7 8.5 7.67 10 8.5 10m3.5 7.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5',
  fontSize: 'M9 4v3h5v12h3V7h5V4zm-6 8h3v7h3v-7h3V9H3z',
  clearFormatting:
    'M3.27 5 2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21 18 19.73 3.55 5.27zM6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5z',
  undo: 'M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8',
  redo: 'M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7z'
}

export interface EditorIconProps extends Omit<SvgIconProps, 'children'> {
  name: EditorIconName
}

/** A decorative toolbar icon: the button carries the accessible name */
export function EditorIcon({ name, ...props }: EditorIconProps): ReactElement {
  const twakeIcon = TWAKE_ICONS[name]
  if (twakeIcon) return <Icon icon={twakeIcon} size={16} aria-hidden="true" />
  return (
    <SvgIcon fontSize="small" aria-hidden="true" {...props}>
      <path d={PATHS[name]} />
    </SvgIcon>
  )
}
