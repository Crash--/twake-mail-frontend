// Upstream to twake-ui: yes. Dropping files on a panel (a message, a
// conversation, a folder) is common to Mail, Chat and Drive; twake-mui has
// no drop zone.
import { Box, Typography } from '@linagora/twake-mui'
import {
  useRef,
  useState,
  type DragEvent,
  type ReactElement,
  type ReactNode
} from 'react'

export interface FileDropZoneProps {
  /** Shown over the zone while files are dragged over it */
  label: string
  onFiles: (files: File[]) => void
  /**
   * Leaves a drag to what is under the pointer (an editor taking dropped
   * images inline): true for the drags the zone must ignore
   */
  isForChild?: (event: DragEvent<HTMLElement>) => boolean
  children: ReactNode
  className?: string
  'data-testid'?: string
}

function hasFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files')
}

/**
 * A zone taking the files dropped on it (from the file manager), with a
 * label over it while they are dragged. Dragged text and links are left
 * to what is under it. The same files can be picked with a button, which
 * is the keyboard way: this only adds the mouse one.
 */
export function FileDropZone({
  label,
  onFiles,
  isForChild = () => false,
  children,
  className,
  'data-testid': testId
}: FileDropZoneProps): ReactElement {
  const [isOver, setIsOver] = useState(false)
  // dragenter and dragleave fire for every child crossed
  const depth = useRef(0)

  const handleDragEnter = (event: DragEvent<HTMLDivElement>): void => {
    if (!hasFiles(event)) return
    event.preventDefault()
    depth.current += 1
    setIsOver(true)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>): void => {
    if (!hasFiles(event)) return
    // Over the child, the child shows where the files go
    const isChild = isForChild(event)
    setIsOver(!isChild)
    if (isChild) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>): void => {
    if (!hasFiles(event)) return
    depth.current = Math.max(depth.current - 1, 0)
    if (depth.current === 0) setIsOver(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    if (!hasFiles(event)) return
    if (isForChild(event)) {
      depth.current = 0
      setIsOver(false)
      return
    }
    event.preventDefault()
    event.stopPropagation()
    depth.current = 0
    setIsOver(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) onFiles(files)
  }

  return (
    <Box
      className={className}
      // Capture: the editor inside would take the dropped images first
      onDragEnterCapture={handleDragEnter}
      onDragOverCapture={handleDragOver}
      onDragLeaveCapture={handleDragLeave}
      onDropCapture={handleDrop}
      sx={{ position: 'relative' }}
      data-testid={testId}
    >
      {children}
      {isOver ? (
        <Box
          aria-hidden="true"
          className="u-flex u-flex-items-center u-flex-justify-center"
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
            border: '2px dashed',
            borderColor: 'primary.main',
            borderRadius: 1,
            bgcolor: 'background.paper',
            opacity: 0.95
          }}
        >
          <Typography variant="h6" component="p" color="primary">
            {label}
          </Typography>
        </Box>
      ) : null}
    </Box>
  )
}
