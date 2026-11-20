import { useEffect, useRef, useState, type RefObject } from 'react'

const HOVER_QUERY = '(hover: hover)'

/** A screen with hover: elsewhere (touch), the actions are always shown */
function canHover(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia(HOVER_QUERY).matches
  )
}

/** `:hover` may be unsupported by the selector engine (jsdom) */
function isHovered(element: Element): boolean {
  try {
    return element.matches(':hover')
  } catch {
    return false
  }
}

function holdsFocus(element: Element | null): boolean {
  return element?.contains(document.activeElement) ?? false
}

export interface RowActivation {
  /** On an element inside the row */
  ref: RefObject<HTMLElement | null>
  /** Whether the row was hovered or focused since it mounted */
  isActive: boolean
}

/**
 * Whether the row holding `ref` (the closest `rowSelector`) was hovered, or
 * held the focus, since it mounted; always on a screen without hover. Once
 * active, a row stays so. The row after it holding the focus activates it
 * too: Shift+Tab from there reaches its actions. Not `enabled`, the row
 * is active from the start.
 */
export function useRowActivation(
  rowSelector: string,
  enabled: boolean
): RowActivation {
  const ref = useRef<HTMLElement | null>(null)
  const [isActive, setIsActive] = useState(() => !enabled || !canHover())

  useEffect(() => {
    if (isActive) return
    const row = ref.current?.closest(rowSelector) ?? null
    const parent = row?.parentElement ?? null
    if (row === null || parent === null) {
      setIsActive(true)
      return
    }
    const activate = (): void => {
      setIsActive(true)
    }
    const handleFocusIn = (event: FocusEvent): void => {
      if (!(event.target instanceof Node)) return
      if (
        row.contains(event.target) ||
        (row.nextElementSibling?.contains(event.target) ?? false)
      ) {
        activate()
      }
    }
    if (
      isHovered(row) ||
      holdsFocus(row) ||
      holdsFocus(row.nextElementSibling)
    ) {
      activate()
      return
    }
    row.addEventListener('pointerenter', activate)
    parent.addEventListener('focusin', handleFocusIn)
    return () => {
      row.removeEventListener('pointerenter', activate)
      parent.removeEventListener('focusin', handleFocusIn)
    }
  }, [isActive, rowSelector])

  return { ref, isActive }
}
