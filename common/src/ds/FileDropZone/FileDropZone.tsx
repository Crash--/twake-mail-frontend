// Upstream to twake-ui: yes. Dropping files on a panel (a message, a
// conversation, a folder) is common to Mail, Chat and Drive; twake-mui has
// no drop zone.
import { Icon } from '@linagora/twake-icons'
import { Box, Typography } from '@linagora/twake-mui'
import {
  useRef,
  useState,
  type DragEvent,
  type ReactElement,
  type ReactNode
} from 'react'
import { File } from '@/ds/FlutterIcons/FlutterIcons'

// Figma "Teammail 1.1" tokens the theme does not carry
const DASH_COLOR = '#5aa9ff'
const PANEL_COLOR = '#f5faff'
const ICON_BACKGROUND = '#d4e8ff'

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
            p: 2,
            boxSizing: 'border-box',
            pointerEvents: 'none',
            bgcolor: 'background.paper'
          }}
        >
          {/* Figma "Attachment - drag & drop": a dashed light blue panel */}
          <Box
            className="u-flex u-flex-column u-flex-items-center u-flex-justify-center u-w-100 u-h-100"
            sx={{
              gap: 2,
              border: '2px dashed',
              borderColor: DASH_COLOR,
              borderRadius: '8px',
              bgcolor: PANEL_COLOR
            }}
          >
            <Box
              className="u-flex u-flex-items-center u-flex-justify-center"
              sx={{
                width: 64,
                height: 64,
                borderRadius: '16px',
                bgcolor: ICON_BACKGROUND,
                color: 'primary.main'
              }}
            >
              <Icon icon={File} size={28} color="currentColor" />
            </Box>
            <Typography
              variant="subtitle1"
              component="p"
              sx={{ fontWeight: 600, color: 'text.primary' }}
            >
              {label}
            </Typography>
          </Box>
        </Box>
      ) : null}
    </Box>
  )
}
