import { useEffect, useState, type ReactElement, type ReactNode } from 'react'

/**
 * How long a view waits before it shows its skeleton, in ms: a load that is
 * about done by then (most are, on a good connection) never flashes one, and
 * the first rows do not wait for the skeleton to be rendered
 */
export const SKELETON_DELAY_MS = 150

export interface AfterDelayProps {
  children: ReactNode
  delayMs?: number
}

/**
 * Renders nothing for `delayMs`, then its children: the boxes it stands for
 * are the same, so that what lands under it does not move. Unmounts with the
 * data, so a quick load costs nothing. With no delay, the children render
 * from the first paint.
 */
export function AfterDelay({
  children,
  delayMs = SKELETON_DELAY_MS
}: AfterDelayProps): ReactElement | null {
  const [isElapsed, setIsElapsed] = useState(delayMs <= 0)
  useEffect(() => {
    if (delayMs <= 0) return
    const timer = setTimeout(() => {
      setIsElapsed(true)
    }, delayMs)
    return () => {
      clearTimeout(timer)
    }
  }, [delayMs])
  return isElapsed ? <>{children}</> : null
}
