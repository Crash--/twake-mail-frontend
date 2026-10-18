/**
 * Fits a wide email in the width of its frame, so that its body never
 * scrolls sideways (a newsletter would put its scrollbar at its very bottom).
 * tmail-flutter does it on phones (TF-4799,
 * `MobileEmailResponsiveLayoutScript`); here at every width:
 *
 * 1. a block that cannot wrap its text because of `white-space` gets to wrap;
 * 2. the outermost elements wider than the room they have (the roots) are
 *    reflowed: a wrapper or a table of fixed width takes 100 % of it, the
 *    fixed widths of its cells become proportions, keeping the typography;
 * 3. what still does not fit (an image-less block of fixed width, a table
 *    whose content cannot wrap) is scaled down with `zoom`, which, unlike a
 *    transform, also scales its layout box: the frame takes its height.
 *
 * The frame runs no script: the app does it from outside, with the styles of
 * the elements, which `undo` puts back before the next pass. The decisions
 * read the layout through a `LayoutProbe`, which tests fake.
 */

/**
 * Class of a scaled element, whose zoom is the custom property
 * `FIT_ZOOM_PROPERTY` (the document stylesheet applies it): the CSSOM of jsdom
 * drops a `zoom`, not a custom property
 */
export const FIT_SCALED_CLASS = 'tmail-fit-scaled'
export const FIT_ZOOM_PROPERTY = '--tmail-fit-zoom'

/** What the fitting reads of the layout */
export interface LayoutProbe {
  /** Left edge and width of the rendered box, zoom included */
  box(element: Element): { left: number; width: number }
  /** Width inside the borders, scrollbar excluded */
  clientWidth(element: Element): number
  /** Width of the content, overflow included */
  scrollWidth(element: Element): number
  /** A computed style */
  style(element: Element, property: 'white-space' | 'overflow-x'): string
}

/** The layout of the browser */
export const domLayoutProbe: LayoutProbe = {
  box: element => {
    const rect = element.getBoundingClientRect()
    return { left: rect.left, width: rect.width }
  },
  clientWidth: element => element.clientWidth,
  scrollWidth: element => element.scrollWidth,
  style: (element, property) =>
    element.ownerDocument.defaultView
      ?.getComputedStyle(element)
      .getPropertyValue(property) ?? ''
}

/** Puts back the styles a fitting changed */
export type UndoFit = () => void

// Sub-pixel rounding is not an overflow
const SLACK = 1
// Each pass reflows the roots the previous one left; the last scales them
const MAX_PASSES = 3
const MAX_ZOOM_CORRECTIONS = 3

const REPLACED_ELEMENTS = new Set([
  'IMG',
  'IFRAME',
  'VIDEO',
  'CANVAS',
  'SVG',
  'OBJECT',
  'EMBED'
])

/**
 * The `white-space` that lets the text of an element wrap, null when it
 * already can. Preformatted text keeps its spaces
 */
export function wrappableWhiteSpace(whiteSpace: string): string | null {
  if (whiteSpace === 'nowrap') return 'normal'
  if (whiteSpace === 'pre') return 'pre-wrap'
  return null
}

/** A width the sender fixed in pixels, by attribute or inline style */
export function hasFixedWidth(element: HTMLElement): boolean {
  const styleWidth = element.style.width
  const attributeWidth = element.getAttribute('width') ?? ''
  return (
    (styleWidth !== '' && !styleWidth.includes('%')) ||
    (attributeWidth !== '' && !attributeWidth.includes('%'))
  )
}

/**
 * The zoom that brings `naturalWidth` into `availableWidth`, rounded down so
 * that it never overflows by a hair; 1 when it fits
 */
export function fitScale(naturalWidth: number, availableWidth: number): number {
  if (availableWidth <= 0 || naturalWidth <= availableWidth + SLACK) return 1
  return Math.floor((availableWidth / naturalWidth) * 10000) / 10000
}

/** `width` as a percentage of `ownerWidth`, at most 100 % */
export function proportion(width: number, ownerWidth: number): string {
  return `${Math.min(100, (width / ownerWidth) * 100).toFixed(3)}%`
}

function isReplaced(element: Element): boolean {
  return REPLACED_ELEMENTS.has(element.tagName.toUpperCase())
}

function elementsOf(root: Element): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('*'))
}

/**
 * Measures of one state of the layout, kept until the next change of style:
 * the whole scan costs one layout
 */
function measuresOf(
  content: HTMLElement,
  probe: LayoutProbe
): {
  width: (element: Element) => number
  available: (element: Element) => number
  overflows: (element: Element) => boolean
} {
  const contentLeft = probe.box(content).left
  const contentWidth = probe.clientWidth(content)
  const boxes = new Map<Element, { left: number; width: number }>()
  const clientWidths = new Map<Element, number>()
  const box = (element: Element): { left: number; width: number } => {
    const known = boxes.get(element)
    if (known) return known
    const measured = probe.box(element)
    boxes.set(element, measured)
    return measured
  }
  const clientWidth = (element: Element): number => {
    const known = clientWidths.get(element)
    if (known !== undefined) return known
    const measured = probe.clientWidth(element)
    clientWidths.set(element, measured)
    return measured
  }
  const available = (element: Element): number => {
    const fromContent =
      contentWidth - Math.max(0, box(element).left - contentLeft)
    const parent = element.parentElement
    // An inline parent has no width of its own
    const parentWidth =
      parent === null || parent === content ? 0 : clientWidth(parent)
    return Math.max(
      0,
      parentWidth > 0 ? Math.min(fromContent, parentWidth) : fromContent
    )
  }
  return {
    width: element => box(element).width,
    available,
    overflows: element => {
      const room = available(element)
      return room > 0 && box(element).width > room + SLACK
    }
  }
}

/**
 * Fits the content of the email in its own width (see above); `content` is
 * the wrapper of the document, whose width is that of the frame
 */
export function fitEmailLayout(
  content: HTMLElement,
  probe: LayoutProbe = domLayoutProbe
): UndoFit {
  const saved: {
    element: HTMLElement
    property: string
    value: string
    priority: string
  }[] = []
  const scaled: HTMLElement[] = []
  const undo = (): void => {
    for (const element of scaled) element.classList.remove(FIT_SCALED_CLASS)
    scaled.length = 0
    for (const change of saved.reverse()) {
      if (change.value === '') {
        change.element.style.removeProperty(change.property)
      } else {
        change.element.style.setProperty(
          change.property,
          change.value,
          change.priority
        )
      }
    }
    saved.length = 0
  }
  // Important: the inline style must win over the stylesheet of the email
  const set = (element: HTMLElement, property: string, value: string): void => {
    saved.push({
      element,
      property,
      value: element.style.getPropertyValue(property),
      priority: element.style.getPropertyPriority(property)
    })
    element.style.setProperty(property, value, 'important')
  }
  const measure = (): ReturnType<typeof measuresOf> =>
    measuresOf(content, probe)

  const relaxText = (elements: readonly HTMLElement[]): void => {
    // Every read before the first write
    const whiteSpaces = elements.map(element =>
      wrappableWhiteSpace(probe.style(element, 'white-space'))
    )
    elements.forEach((element, index) => {
      const whiteSpace = whiteSpaces[index]
      if (whiteSpace) set(element, 'white-space', whiteSpace)
      set(element, 'word-break', 'break-word')
    })
  }

  // Border box: 100 % with the padding of the sender would overflow again
  const fillWidth = (element: HTMLElement): void => {
    set(element, 'box-sizing', 'border-box')
    set(element, 'width', '100%')
    set(element, 'max-width', '100%')
    set(element, 'min-width', '0')
  }

  const scale = (element: HTMLElement): void => {
    const measures = measure()
    const naturalWidth = measures.width(element)
    let zoom = fitScale(naturalWidth, measures.available(element))
    if (zoom === 1) return
    // Its width in pixels: a percentage would be resolved again in the
    // zoomed box, as wide as before
    set(element, 'box-sizing', 'border-box')
    set(element, 'width', `${String(naturalWidth)}px`)
    set(element, 'max-width', 'none')
    set(element, FIT_ZOOM_PROPERTY, String(zoom))
    if (!element.classList.contains(FIT_SCALED_CLASS)) {
      element.classList.add(FIT_SCALED_CLASS)
      scaled.push(element)
    }
    // The layout does not scale exactly (rounded borders and spacing, text
    // at a smaller size): measured again, the zoom corrected
    for (let attempt = 0; attempt < MAX_ZOOM_CORRECTIONS; attempt += 1) {
      const after = measure()
      const corrected = fitScale(after.width(element), after.available(element))
      if (corrected === 1) return
      zoom = Math.floor(zoom * corrected * 10000) / 10000
      set(element, FIT_ZOOM_PROPERTY, String(zoom))
    }
  }

  // An inline box reports no scroll width: a cell grows to fit it, so it only
  // shows against the width of the email
  const overflowsOwnBox = (element: HTMLElement, width: number): boolean => {
    const client = probe.clientWidth(element)
    const scroll = probe.scrollWidth(element)
    if (client !== 0 || scroll !== 0) return scroll > client + SLACK
    return width > 0 && probe.box(element).width > width + SLACK
  }

  const relaxNoWrap = (): void => {
    const width = probe.clientWidth(content)
    relaxText(
      elementsOf(content).filter(element => {
        if (!overflowsOwnBox(element, width)) return false
        if (!wrappableWhiteSpace(probe.style(element, 'white-space'))) {
          return false
        }
        // A block that scrolls by itself is meant to
        const overflowX = probe.style(element, 'overflow-x')
        return overflowX === 'visible' || overflowX === 'clip'
      })
    )
  }

  const fitTable = (table: HTMLElement): void => {
    const naturalWidth = measure().width(table)
    // The cells of this table, not of the nested ones
    const cells = Array.from(
      table.querySelectorAll<HTMLElement>('td, th, col')
    ).filter(cell => cell.closest('table') === table && hasFixedWidth(cell))
    const before = measure()
    const widths = cells.map(cell => before.width(cell))
    fillWidth(table)
    cells.forEach((cell, index) => {
      const width = widths[index] ?? 0
      if (width > 0 && naturalWidth > 0) {
        set(cell, 'width', proportion(width, naturalWidth))
      }
    })
    if (!measure().overflows(table)) return

    // Breaking long words keeps the size of the text: tried first
    relaxText(Array.from(table.querySelectorAll<HTMLElement>('td, th')))
    if (!measure().overflows(table)) return

    // Widths from a stylesheet or a nested table: proportions of the layout
    const layout = measure()
    const columns = Array.from(
      table.querySelectorAll<HTMLElement>('td, th, col')
    ).map(cell => {
      const owner = cell.parentElement?.closest('table') ?? null
      return {
        cell,
        width: layout.width(cell),
        ownerWidth: owner === null ? 0 : layout.width(owner)
      }
    })
    for (const nested of table.querySelectorAll<HTMLElement>('table')) {
      fillWidth(nested)
    }
    for (const { cell, width, ownerWidth } of columns) {
      if (width > 0 && ownerWidth > 0) {
        set(cell, 'width', proportion(width, ownerWidth))
      }
    }
    if (!measure().overflows(table)) return

    scale(table)
  }

  const fitWrapper = (root: HTMLElement): void => {
    fillWidth(root)
    // The wrappers inside, outside the tables, in one go
    const measures = measure()
    const wrappers = elementsOf(root).filter(
      element =>
        element.closest('table') === null &&
        !isReplaced(element) &&
        measures.overflows(element)
    )
    wrappers.forEach(fillWidth)
    const tables = Array.from(
      root.querySelectorAll<HTMLElement>('table')
    ).filter(table => table.parentElement?.closest('table') === null)
    const after = measure()
    for (const table of tables) {
      if (after.overflows(table)) fitTable(table)
    }
    if (tables.length === 0 && measure().overflows(root)) scale(root)
  }

  const overflowRoots = (): HTMLElement[] => {
    const measures = measure()
    return elementsOf(content).filter(element => {
      if (!measures.overflows(element)) return false
      const parent = element.parentElement
      return (
        parent === null || parent === content || !measures.overflows(parent)
      )
    })
  }

  if (probe.clientWidth(content) === 0) return undo
  try {
    relaxNoWrap()
    for (let pass = 1; pass <= MAX_PASSES; pass += 1) {
      const roots = overflowRoots()
      if (roots.length === 0) break
      for (const root of roots) {
        if (pass === MAX_PASSES || isReplaced(root)) scale(root)
        else if (root.tagName.toUpperCase() === 'TABLE') fitTable(root)
        else fitWrapper(root)
      }
    }
  } catch {
    // A layout it cannot fit stays as the sender wrote it
    undo()
  }
  return undo
}
