import { useEffect, useRef, useState, type RefObject } from 'react'

import { onFocusInside } from './focusInside'

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

function contains(element: Element | null, target: Node | null): boolean {
  return target !== null && (element?.contains(target) ?? false)
}

/** The row, or the row after it (Shift+Tab from there reaches its actions) */
function ownsFocus(row: Element, target: Node | null): boolean {
  return contains(row, target) || contains(row.nextElementSibling, target)
}

export interface RowActivation {
  /** On an element inside the row */
  ref: RefObject<HTMLElement | null>
  /** Whether the row is hovered or owns the focus */
  isActive: boolean
}

/**
 * Whether the row holding `ref` (the closest `rowSelector`) is hovered or
 * owns the focus; always on a screen without hover. The row owns the focus
 * from the moment it, or the row after it (Shift+Tab from there reaches its
 * actions), takes it, until another element of the table takes it: focus
 * moving out of the table (a menu its actions opened) keeps the row active,
 * so the anchor of that menu stays mounted. Not `enabled`, the row is
 * always active.
 */
export function useRowActivation(
  rowSelector: string,
  enabled: boolean
): RowActivation {
  const ref = useRef<HTMLElement | null>(null)
  const isLazy = enabled && canHover()
  const [isActive, setIsActive] = useState(() => !isLazy)

  useEffect(() => {
    if (!isLazy) return
    const row = ref.current?.closest(rowSelector) ?? null
    const parent = row?.parentElement ?? null
    if (row === null || parent === null) {
      setIsActive(true)
      return
    }
    let isHover = isHovered(row)
    let hasFocus = ownsFocus(row, document.activeElement)
    const update = (): void => {
      setIsActive(isHover || hasFocus)
    }
    const handlePointerEnter = (): void => {
      isHover = true
      update()
    }
    const handlePointerLeave = (): void => {
      isHover = false
      update()
    }
    update()
    row.addEventListener('pointerenter', handlePointerEnter)
    row.addEventListener('pointerleave', handlePointerLeave)
    const stopFocus = onFocusInside(parent, target => {
      hasFocus = ownsFocus(row, target)
      update()
    })
    return () => {
      row.removeEventListener('pointerenter', handlePointerEnter)
      row.removeEventListener('pointerleave', handlePointerLeave)
      stopFocus()
    }
  }, [isLazy, rowSelector])

  return { ref, isActive }
}
