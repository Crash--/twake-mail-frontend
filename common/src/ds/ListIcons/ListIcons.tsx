// Upstream to twake-ui: yes, to @linagora/twake-icons, which has neither a
// "filter list" icon (three decreasing lines) nor an empty checkbox
// (docs/twake-mui-gaps.md). Paths of Material Icons `filter_list` and
// `check_box_outline_blank` (Google Material Icons, Apache-2.0), drawn on the
// current text colour so that `Icon` can size and colour them.
import type { ReactElement, SVGAttributes } from 'react'

const FILTER_LIST_PATH = 'M10 18h4v-2h-4zM3 6v2h18V6zm3 7h12v-2H6z'
const CHECKBOX_BLANK_PATH =
  'M19 5v14H5V5zm0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z'

function drawIcon(
  path: string,
  props: SVGAttributes<SVGSVGElement>
): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d={path} />
    </svg>
  )
}

/** Three decreasing lines, the "Filter" of the list toolbar */
export function FilterListIcon(
  props: SVGAttributes<SVGSVGElement>
): ReactElement {
  return drawIcon(FILTER_LIST_PATH, props)
}

/** An empty square, the "Select all" of the list toolbar */
export function CheckboxBlankIcon(
  props: SVGAttributes<SVGSVGElement>
): ReactElement {
  return drawIcon(CHECKBOX_BLANK_PATH, props)
}
