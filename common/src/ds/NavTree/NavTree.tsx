// Upstream to twake-ui: yes, as a prop of `Nav`. twake-mui's `Nav` has a
// fixed `margin: 24px 0`, which leaves a gap under a section header, a
// `<nav>` of its own that nests in the named one of a section, and no
// keyboard pattern for the `role="tree"` it can be given.
import {
  useEffect,
  useRef,
  type FocusEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode
} from 'react'

import { NavList } from '@/ds/NavList/NavList'

import {
  findTypeaheadMatch,
  isTypeaheadKey,
  resolveNavTreeKey,
  type NavTreeRow
} from './navTreeKeys'

export interface NavTreeProps {
  children: ReactNode
  /**
   * `tree` gives the keyboard pattern of a tree view (WAI-ARIA APG) to the
   * `NavTreeItem` rows with `role="treeitem"` it holds; without it the
   * list is plain and its links are reached with Tab
   */
  role?: 'tree'
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-busy'?: boolean
  'data-testid'?: string
}

const ITEM = '[role="treeitem"]'
/** The link of a row is only a target for the pointer */
const ROW_LINK = 'a[href]'
const ROW_BUTTONS = 'button:not(:disabled)'
/** How long the letters typed to jump to a row are remembered */
const TYPEAHEAD_RESET_MS = 500

function getItems(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(ITEM))
}

function setTabIndex(element: HTMLElement, value: '0' | '-1'): void {
  if (element.getAttribute('tabindex') !== value) {
    element.setAttribute('tabindex', value)
  }
}

/** The single tab stop is `tabStop`, and the buttons of its row follow it */
function applyTabStops(
  items: readonly HTMLElement[],
  tabStop: HTMLElement | undefined
): void {
  for (const item of items) {
    const isStop = item === tabStop
    setTabIndex(item, isStop ? '0' : '-1')
    for (const link of item.querySelectorAll<HTMLElement>(ROW_LINK)) {
      setTabIndex(link, '-1')
    }
    for (const button of item.querySelectorAll<HTMLElement>(ROW_BUTTONS)) {
      setTabIndex(button, isStop ? '0' : '-1')
    }
  }
}

function toRow(item: HTMLElement): NavTreeRow {
  const expanded = item.getAttribute('aria-expanded')
  return {
    level: Number(item.getAttribute('aria-level') ?? 1),
    isExpanded: expanded === null ? null : expanded === 'true',
    label: item.textContent.trim()
  }
}

/**
 * A `Nav` list of a sidebar section, without the outer margin of `Nav` nor
 * its `<nav>`: the section around it is the navigation landmark.
 *
 * With `role="tree"` it is a tree view as the WAI-ARIA APG describes it,
 * over its `role="treeitem"` rows (flat: `aria-level` gives the depth):
 * - one tab stop: the row last focused, else the selected one
 *   (`aria-selected`), else the first (roving `tabindex`); the links and
 *   buttons of the other rows are out of the tab sequence, the buttons of
 *   that row follow it;
 * - Down / Up: next / previous row; Home / End: first / last;
 * - Right: expands a collapsed row (its `[data-nav-toggle]` button), or goes
 *   to its first child; Left: collapses an expanded row, or goes to its
 *   parent; Enter: follows the link of the row; letters: typeahead;
 * - when the row holding the focus leaves the tree, the focus goes to the
 *   row that takes its place instead of falling back to the page.
 * The DOM is read and its `tabindex` kept in step by a `MutationObserver`,
 * so rows come and go, and are selected, without telling the tree.
 */
export function NavTree({
  children,
  role,
  ...props
}: NavTreeProps): ReactElement {
  const rootRef = useRef<HTMLUListElement>(null)
  // The row that last held the focus: the tab stop, and what to replace
  const activeRef = useRef<HTMLElement | null>(null)
  const activeIndexRef = useRef(0)
  const hasFocusRef = useRef(false)
  const typedRef = useRef('')
  const typedTimerRef = useRef<number | null>(null)
  const isTree = role === 'tree'

  useEffect(() => {
    const root = rootRef.current
    if (!isTree || root === null) return undefined

    const sync = (): void => {
      const items = getItems(root)
      let active = activeRef.current
      if (active !== null && !active.isConnected) {
        // The row that held the focus is gone: the row that takes its place
        // gets it (when it was the focus, not a click elsewhere)
        const next = items[Math.min(activeIndexRef.current, items.length - 1)]
        active = next ?? null
        activeRef.current = active
        const isLost =
          document.activeElement === null ||
          document.activeElement === document.body
        if (hasFocusRef.current && isLost) next?.focus()
      }
      if (active !== null) activeIndexRef.current = items.indexOf(active)
      applyTabStops(
        items,
        active !== null && items.includes(active)
          ? active
          : (items.find(
              item => item.getAttribute('aria-selected') === 'true'
            ) ?? items[0])
      )
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-selected']
    })
    return () => {
      observer.disconnect()
    }
  }, [isTree])

  useEffect(
    () => () => {
      if (typedTimerRef.current !== null) {
        window.clearTimeout(typedTimerRef.current)
      }
    },
    []
  )

  const handleFocus = (event: FocusEvent<HTMLElement>): void => {
    const root = rootRef.current
    const target = event.target
    const item = target.closest<HTMLElement>(ITEM)
    if (!isTree || root === null || item === null) return
    hasFocusRef.current = true
    // Reached with the pointer, the link hands the focus to its row, which
    // is where the arrow keys start from
    if (target !== item && target.matches(ROW_LINK)) {
      item.focus({ preventScroll: true })
      return
    }
    const items = getItems(root)
    activeRef.current = item
    activeIndexRef.current = items.indexOf(item)
    applyTabStops(items, item)
  }

  const handleBlur = (event: FocusEvent<HTMLElement>): void => {
    const next = event.relatedTarget
    if (next instanceof Node) {
      // Gone to another element: out of the tree, or from row to row
      if (rootRef.current?.contains(next) !== true) hasFocusRef.current = false
      return
    }
    // Nowhere: the window lost the focus, or a click on nothing, or the row
    // holding the focus was removed (then it is no longer in the page)
    const row = activeRef.current
    window.setTimeout(() => {
      if (row?.isConnected === true) hasFocusRef.current = false
    }, 0)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const root = rootRef.current
    const target = event.target as HTMLElement
    // Only from the row itself: its buttons keep their own keys
    if (
      !isTree ||
      root === null ||
      target.getAttribute('role') !== 'treeitem'
    ) {
      return
    }
    if (event.ctrlKey || event.altKey || event.metaKey) return
    const items = getItems(root)
    const current = items.indexOf(target)
    if (current === -1) return
    const rows = items.map(toRow)

    if (isTypeaheadKey(event)) {
      typedRef.current += event.key
      if (typedTimerRef.current !== null) {
        window.clearTimeout(typedTimerRef.current)
      }
      typedTimerRef.current = window.setTimeout(() => {
        typedRef.current = ''
        typedTimerRef.current = null
      }, TYPEAHEAD_RESET_MS)
      // The letters belong to the tree, found or not: the same key does not
      // do something else depending on the names of the folders
      event.preventDefault()
      const match = findTypeaheadMatch(rows, current, typedRef.current)
      if (match !== -1) items[match]?.focus()
      return
    }

    if (event.shiftKey) return
    const result = resolveNavTreeKey(rows, current, event.key)
    if (result === null) return
    if (result.type === 'focus') {
      event.preventDefault()
      items[result.index]?.focus()
    } else if (result.type === 'toggle') {
      const toggle = target.querySelector<HTMLElement>('[data-nav-toggle]')
      if (toggle === null) return
      event.preventDefault()
      toggle.click()
    } else {
      const link = target.querySelector<HTMLElement>(ROW_LINK)
      if (link === null) return
      event.preventDefault()
      link.click()
    }
  }

  return (
    <NavList
      ref={rootRef}
      sx={{ my: 0 }}
      role={role}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {children}
    </NavList>
  )
}
