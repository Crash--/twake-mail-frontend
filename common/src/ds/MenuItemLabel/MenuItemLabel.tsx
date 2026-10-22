// Upstream to twake-ui: yes, a menu item label that never overflows the
// menu: on one line, cut with an ellipsis when it is too long for the width
// of a menu, its full text in a tooltip on hover then.
import { ListItemText, Tooltip } from '@linagora/twake-mui'
import { useRef, useState, type ReactElement } from 'react'

export interface MenuItemLabelProps {
  label: string
  /** A palette colour of the text (`error.dark` for a destructive action) */
  color?: string
}

/** The text of a `MenuItem`, after its `ListItemIcon` */
export function MenuItemLabel({
  label,
  color = 'inherit'
}: MenuItemLabelProps): ReactElement {
  const textRef = useRef<HTMLSpanElement>(null)
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  const [isTruncated, setIsTruncated] = useState(false)

  const handleTooltipOpen = (): void => {
    const text = textRef.current
    setIsTruncated(text !== null && text.scrollWidth > text.clientWidth)
    setIsTooltipOpen(true)
  }
  const handleTooltipClose = (): void => {
    setIsTooltipOpen(false)
  }

  return (
    <Tooltip
      title={label}
      open={isTooltipOpen && isTruncated}
      onOpen={handleTooltipOpen}
      onClose={handleTooltipClose}
      // The label is the text: the tooltip names nothing
      describeChild
      disableInteractive
      enterDelay={500}
      placement="right"
    >
      <ListItemText
        primary={label}
        slotProps={{
          primary: { ref: textRef, noWrap: true, color }
        }}
      />
    </Tooltip>
  )
}
