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

const OVERLAY_SX = {
  position: 'absolute',
  inset: '8px',
  zIndex: 1,
  gap: '20px',
  p: '20px',
  boxSizing: 'border-box',
  pointerEvents: 'none',
  border: '2px dashed #46A2FF',
  borderRadius: '16px',
  // #F6FAFF at 70 %: what is under it still shows
  bgcolor: 'rgba(246, 250, 255, 0.7)'
} as const

const LABEL_SX = {
  fontSize: 22,
  fontWeight: 600,
  color: '#000000',
  textAlign: 'center'
} as const

/** `ic_drop_zone_icon`: a file on a light blue rounded square, 80 px */
function DropIcon(): ReactElement {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
    >
      <rect width="80" height="80" rx="20" fill="#D1E9FF" />
      <path
        d="M44.1339 23.4943C44.6289 23.6084 45.0669 23.7898 45.4976 24.0592C45.9282 24.3285 46.2771 24.6112 47.19 25.5241L52.8087 31.1429C53.7216 32.0558 54.0044 32.4046 54.2737 32.8353C54.543 33.266 54.7244 33.7039 54.8385 34.1989C54.9526 34.6939 54.9993 35.1405 54.9993 36.4315V48.5905C54.9993 50.8192 54.7673 51.6275 54.3315 52.4423C53.8958 53.2571 53.2563 53.8966 52.4415 54.3323C51.6266 54.7681 50.8184 55.0002 48.5896 55.0002H33.0757C30.8469 55.0002 30.0387 54.7681 29.2239 54.3323C28.4091 53.8966 27.7696 53.2571 27.3338 52.4423C26.8981 51.6275 26.666 50.8192 26.666 48.5905V29.7432C26.666 27.5144 26.8981 26.7062 27.3338 25.8914C27.7696 25.0766 28.4091 24.4371 29.2239 24.0013C30.0387 23.5656 30.8469 23.3335 33.0757 23.3335H41.9013C43.1924 23.3335 43.639 23.3802 44.1339 23.4943ZM42.9993 26.5406C42.7232 26.5406 42.4993 26.7645 42.4993 27.0406V33.3335C42.4993 33.7938 42.8724 34.1669 43.3327 34.1669H49.6256C49.7582 34.1669 49.8854 34.1142 49.9791 34.0204C50.1744 33.8252 50.1744 33.5086 49.9791 33.3133L43.3529 26.6871C43.2591 26.5933 43.132 26.5406 42.9993 26.5406Z"
        fill="#007AFF"
      />
    </svg>
  )
}

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
        // tmail-flutter's drop zone (`LocalFileDropZoneWidget`): a pale
        // blue panel, 8 px in, its dashed border, the icon and the label
        <Box
          aria-hidden="true"
          className="u-flex u-flex-column u-flex-items-center u-flex-justify-center"
          sx={OVERLAY_SX}
        >
          <DropIcon />
          <Typography component="p" sx={LABEL_SX}>
            {label}
          </Typography>
        </Box>
      ) : null}
    </Box>
  )
}
