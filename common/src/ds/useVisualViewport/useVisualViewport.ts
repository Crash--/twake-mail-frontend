// Upstream to twake-ui: yes, with DockedWindow. A hook on the visual
// viewport, which is what is left of the screen above a virtual keyboard.
import { useEffect, useState } from 'react'

/** The part of the screen the user sees, in CSS pixels */
export interface VisualViewportBox {
  top: number
  height: number
}

/**
 * The visible part of the screen, or null where it is the layout viewport
 * (no `visualViewport`, jsdom) or while the user pinch-zooms. Chrome with
 * `interactive-widget=resizes-content` already resizes the layout viewport
 * when the keyboard opens; Safari does not, and this is what keeps a
 * full-screen window above its keyboard there.
 */
export function useVisualViewport(
  isEnabled: boolean
): VisualViewportBox | null {
  const [box, setBox] = useState<VisualViewportBox | null>(null)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!isEnabled || !viewport) return undefined
    const update = (): void => {
      setBox(
        viewport.scale === 1
          ? { top: viewport.offsetTop, height: viewport.height }
          : null
      )
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [isEnabled])

  return isEnabled ? box : null
}
