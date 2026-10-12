// Upstream to twake-ui: yes, as the drop target support of `NavItem` that
// docs/twake-mui-gaps.md asks for the mailbox tree (Drive needs it for its
// folders too).
import { Box } from '@linagora/twake-mui'
import {
  useRef,
  useState,
  type DragEvent,
  type ReactElement,
  type ReactNode
} from 'react'

export interface DropTargetProps {
  children: ReactNode
  /** Whether what is dragged (its `dataTransfer.types`) may drop here */
  accepts: (types: readonly string[]) => boolean
  onDrop: (dataTransfer: DataTransfer) => void
  className?: string
  'data-testid'?: string
}

/**
 * Where dragged items can be dropped (a folder of a tree): outlined while
 * an accepted drag is over it. Dragging is a pointer-only gesture: the
 * same action must also be reachable from the keyboard (a menu).
 */
export function DropTarget({
  children,
  accepts,
  onDrop,
  className,
  'data-testid': testId
}: DropTargetProps): ReactElement {
  const [isOver, setIsOver] = useState(false)
  // dragenter and dragleave also fire on the children: count them
  const depth = useRef(0)

  const isAccepted = (event: DragEvent<HTMLElement>): boolean =>
    accepts(Array.from(event.dataTransfer.types))

  const handleDragEnter = (event: DragEvent<HTMLElement>): void => {
    if (!isAccepted(event)) return
    depth.current += 1
    setIsOver(true)
  }
  const handleDragOver = (event: DragEvent<HTMLElement>): void => {
    if (!isAccepted(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }
  const handleDragLeave = (event: DragEvent<HTMLElement>): void => {
    if (!isAccepted(event)) return
    depth.current = Math.max(0, depth.current - 1)
    if (depth.current === 0) setIsOver(false)
  }
  const handleDrop = (event: DragEvent<HTMLElement>): void => {
    if (!isAccepted(event)) return
    event.preventDefault()
    depth.current = 0
    setIsOver(false)
    onDrop(event.dataTransfer)
  }

  return (
    <Box
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={className}
      data-drop-over={isOver || undefined}
      data-testid={testId}
      sx={theme => ({
        borderRadius: 1,
        outline: isOver
          ? `2px dashed ${theme.vars.palette.primary.main}`
          : 'none',
        outlineOffset: '-2px',
        backgroundColor: isOver ? theme.vars.palette.action.hover : undefined
      })}
    >
      {children}
    </Box>
  )
}

/**
 * Shows `label` (e.g. "Move 3 messages") under the pointer while dragging,
 * instead of the picture of the dragged element.
 */
export function setDragLabel(
  event: DragEvent<HTMLElement>,
  label: string
): void {
  const ghost = document.createElement('div')
  ghost.textContent = label
  Object.assign(ghost.style, {
    position: 'fixed',
    top: '-1000px',
    left: '0',
    padding: '6px 12px',
    borderRadius: '8px',
    background: '#1b1b1d',
    color: '#ffffff',
    font: '14px sans-serif'
  })
  document.body.appendChild(ghost)
  event.dataTransfer.setDragImage(ghost, 0, 0)
  window.setTimeout(() => {
    ghost.remove()
  }, 0)
}
