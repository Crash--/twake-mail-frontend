// Upstream to twake-ui: with RichTextEditor. Generic: what office suites and
// web pages put on the clipboard, nothing about email.
//
// The color rule follows the reasoning of Messages (La Suite numérique,
// src/frontend/src/features/blocknote/paste-sanitizer.ts, MIT, © DINUM):
// a color the user cannot see while composing must not reach the sent HTML.

/** The only inline styles a paste keeps, the ones the toolbar can set */
const KEPT_STYLES = new Set([
  'color',
  'background-color',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-decoration-line',
  'text-align'
])

const DROPPED_ELEMENTS = 'style, meta, link, script, title, xml, o\\:p'

interface Rgb {
  red: number
  green: number
  blue: number
}

function parseColor(value: string): Rgb | null {
  const trimmed = value.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(trimmed)?.[1]
  if (hex !== undefined) {
    const full =
      hex.length === 3
        ? hex
            .split('')
            .map(digit => digit + digit)
            .join('')
        : hex
    return {
      red: parseInt(full.slice(0, 2), 16),
      green: parseInt(full.slice(2, 4), 16),
      blue: parseInt(full.slice(4, 6), 16)
    }
  }
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(
    trimmed
  )
  if (rgb) {
    if (rgb[4] !== undefined && Number(rgb[4]) === 0) return null
    return {
      red: Number(rgb[1]),
      green: Number(rgb[2]),
      blue: Number(rgb[3])
    }
  }
  if (trimmed === 'black' || trimmed === 'windowtext') {
    return { red: 0, green: 0, blue: 0 }
  }
  if (trimmed === 'white') return { red: 255, green: 255, blue: 255 }
  return null
}

function isGrey({ red, green, blue }: Rgb): boolean {
  return Math.max(red, green, blue) - Math.min(red, green, blue) < 24
}

/** The default text colour of the source: a dark grey nobody chose */
function isDefaultTextColor(value: string): boolean {
  const color = parseColor(value)
  if (color === null) return value.trim() === 'inherit'
  return isGrey(color) && Math.max(color.red, color.green, color.blue) < 110
}

/** The default page colour of the source: white, a light grey, transparent */
function isDefaultBackground(value: string): boolean {
  const trimmed = value.trim().toLowerCase()
  if (trimmed === 'transparent' || trimmed === 'initial') return true
  if (/^rgba\(.*,\s*0\)$/.test(trimmed)) return true
  const color = parseColor(trimmed)
  return (
    color !== null &&
    isGrey(color) &&
    Math.min(color.red, color.green, color.blue) > 230
  )
}

/** Styles that say "nothing special" */
function isNeutral(name: string, value: string): boolean {
  const trimmed = value.trim().toLowerCase()
  if (name === 'font-weight')
    return trimmed === 'normal' || Number(trimmed) < 600
  if (name === 'font-style') return trimmed === 'normal'
  if (name.startsWith('text-decoration'))
    return !/underline|line-through/.test(trimmed)
  if (name === 'text-align')
    return ['start', 'left', 'initial', '-webkit-match-parent'].includes(
      trimmed
    )
  return false
}

/** Bold, italic, underline and strike as elements, the way the editor writes them */
const SEMANTIC_STYLES: {
  test: (style: CSSStyleDeclaration) => boolean
  tag: string
}[] = [
  {
    test: style =>
      Number(style.fontWeight) >= 600 || style.fontWeight.includes('bold'),
    tag: 'strong'
  },
  { test: style => style.fontStyle === 'italic', tag: 'em' },
  {
    test: style =>
      (style.textDecoration || style.textDecorationLine).includes('underline'),
    tag: 'u'
  },
  {
    test: style =>
      (style.textDecoration || style.textDecorationLine).includes(
        'line-through'
      ),
    tag: 's'
  }
]

function wrapSemantics(element: HTMLElement): void {
  if (
    element.tagName === 'A' ||
    element.tagName === 'LI' ||
    element.tagName === 'P'
  )
    return
  for (const { test, tag } of SEMANTIC_STYLES) {
    if (!test(element.style)) continue
    const wrapper = element.ownerDocument.createElement(tag)
    wrapper.append(...Array.from(element.childNodes))
    element.append(wrapper)
  }
  ;[
    'font-weight',
    'font-style',
    'text-decoration',
    'text-decoration-line'
  ].forEach(name => {
    element.style.removeProperty(name)
  })
}

function cleanStyle(element: HTMLElement): void {
  wrapSemantics(element)
  const declarations: string[] = []
  for (const name of Array.from(element.style)) {
    if (!KEPT_STYLES.has(name)) continue
    const value = element.style.getPropertyValue(name)
    if (isNeutral(name, value)) continue
    if (name === 'color' && isDefaultTextColor(value)) continue
    if (name === 'background-color' && isDefaultBackground(value)) continue
    declarations.push(`${name}: ${value}`)
  }
  if (declarations.length > 0) {
    element.setAttribute('style', declarations.join('; '))
  } else {
    element.removeAttribute('style')
  }
}

function unwrap(element: Element): void {
  element.replaceWith(...Array.from(element.childNodes))
}

function removeComments(root: Node): void {
  const walker = root.ownerDocument?.createTreeWalker(
    root,
    NodeFilter.SHOW_COMMENT
  )
  const comments: Node[] = []
  while (walker?.nextNode()) comments.push(walker.currentNode)
  comments.forEach(comment => {
    comment.parentNode?.removeChild(comment)
  })
}

// --- Word lists -------------------------------------------------------------

interface WordListItem {
  paragraph: HTMLElement
  listId: string
  level: number
  ordered: boolean
}

const WORD_LIST_STYLE = /mso-list:\s*(l\d+)\s+level(\d+)/i

function readWordListItem(paragraph: HTMLElement): WordListItem | null {
  const match = WORD_LIST_STYLE.exec(paragraph.getAttribute('style') ?? '')
  if (!match?.[1] || !match[2]) return null
  // The bullet or number Word draws itself, in a `mso-list:Ignore` span
  const marker = Array.from(paragraph.querySelectorAll('span')).find(span =>
    /mso-list:\s*ignore/i.test(span.getAttribute('style') ?? '')
  )
  const markerText = (marker?.textContent ?? '').replace(/\s+/g, '')
  const ordered = /^(\d+|[a-z]{1,4})[.)]$/i.test(markerText)
  // Remove the marker with the font span Word puts around it
  let removable: Element | null | undefined = marker
  while (
    removable?.parentElement &&
    removable.parentElement !== paragraph &&
    removable.parentElement.textContent.replace(/\s+/g, '') === markerText
  ) {
    removable = removable.parentElement
  }
  removable?.remove()
  return {
    paragraph,
    listId: match[1],
    level: Number(match[2]),
    ordered
  }
}

/**
 * Word writes lists as paragraphs with `mso-list` styles and a hand drawn
 * bullet. Rebuilds real nested `<ul>` / `<ol>` from consecutive ones.
 */
function rebuildWordLists(root: HTMLElement): void {
  const paragraphs = Array.from(root.querySelectorAll<HTMLElement>('p'))
  let index = 0
  while (index < paragraphs.length) {
    const first = paragraphs[index]
    const firstItem = first ? readWordListItem(first) : null
    if (!first || !firstItem) {
      index += 1
      continue
    }
    const items: WordListItem[] = [firstItem]
    let next = first.nextElementSibling
    index += 1
    while (next instanceof HTMLElement && next === paragraphs[index]) {
      const item = readWordListItem(next)
      if (!item) break
      items.push(item)
      next = next.nextElementSibling
      index += 1
    }

    const document = first.ownerDocument
    const top = document.createElement(firstItem.ordered ? 'ol' : 'ul')
    const stack: { list: HTMLElement; level: number }[] = [
      { list: top, level: firstItem.level }
    ]
    first.before(top)
    for (const item of items) {
      let current = stack[stack.length - 1]
      while (current && item.level < current.level && stack.length > 1) {
        stack.pop()
        current = stack[stack.length - 1]
      }
      if (current && item.level > current.level) {
        const nested = document.createElement(item.ordered ? 'ol' : 'ul')
        const parentItem = current.list.lastElementChild ?? current.list
        parentItem.append(nested)
        stack.push({ list: nested, level: item.level })
        current = stack[stack.length - 1]
      }
      const listItem = document.createElement('li')
      listItem.append(...Array.from(item.paragraph.childNodes))
      current?.list.append(listItem)
      item.paragraph.remove()
    }
  }
}

// --- entry point ------------------------------------------------------------

/**
 * Cleans HTML pasted from Word, LibreOffice, Google Docs or a web page
 * before the editor parses it (ProseMirror `transformPastedHTML`):
 *
 * - Word lists become real lists, Word and LibreOffice markup goes
 *   (`<o:p>`, conditional comments, `<style>`, `Mso*` classes, `<font>`);
 * - the Google Docs `<b style="font-weight:normal">` wrapper goes;
 * - only the styles the toolbar can set stay, minus the default text and
 *   page colours of the source (spam filters dislike `color:#000000` on
 *   every span);
 * - classes and ids go.
 *
 * The editor schema drops everything else it does not know.
 */
export function cleanPastedHtml(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const body = document.body

  removeComments(body)
  body.querySelectorAll(DROPPED_ELEMENTS).forEach(element => {
    element.remove()
  })
  // Word: elements of its own namespaces (<o:p>, <w:sdt>…) that the
  // selector above cannot reach once namespaced
  Array.from(body.querySelectorAll('*'))
    .filter(element => element.tagName.includes(':'))
    .forEach(unwrap)

  rebuildWordLists(body)

  // Headings would come out at the size of each mail client: bold lines
  body.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
    const paragraph = document.createElement('p')
    const strong = document.createElement('strong')
    strong.append(...Array.from(heading.childNodes))
    paragraph.append(strong)
    heading.replaceWith(paragraph)
  })

  // Google Docs: the fragment is wrapped in a bold that is not bold
  body
    .querySelectorAll<HTMLElement>('b[id^="docs-internal-guid"]')
    .forEach(unwrap)
  // LibreOffice and old pages: <font> carries a face, a size, a colour
  body.querySelectorAll<HTMLElement>('font').forEach(font => {
    const color = font.getAttribute('color')
    if (color && !isDefaultTextColor(color)) {
      const span = document.createElement('span')
      span.style.color = color
      span.append(...Array.from(font.childNodes))
      font.replaceWith(span)
    } else {
      unwrap(font)
    }
  })

  // Links get the editor's link style: the colour and underline the source
  // gave them (on the link, inside it or around it) go
  body.querySelectorAll('a').forEach(link => {
    const wrappers = [
      link,
      ...Array.from(link.querySelectorAll<HTMLElement>('span')),
      ...(link.parentElement?.tagName === 'SPAN' &&
      link.parentElement.childNodes.length === 1
        ? [link.parentElement]
        : [])
    ]
    wrappers.forEach(element => {
      element.style.removeProperty('color')
      element.style.removeProperty('text-decoration')
      element.style.removeProperty('text-decoration-line')
      if (element.getAttribute('style') === '') element.removeAttribute('style')
    })
  })

  body.querySelectorAll<HTMLElement>('*').forEach(element => {
    element.removeAttribute('class')
    element.removeAttribute('id')
    element.removeAttribute('lang')
    element.removeAttribute('dir')
    const align = element.getAttribute('align')
    if (align && !element.style.textAlign) element.style.textAlign = align
    element.removeAttribute('align')
    element.removeAttribute('role')
    element.removeAttribute('aria-level')
    if (element.hasAttribute('style')) cleanStyle(element)
  })

  // Spans left without any style are noise
  body.querySelectorAll('span:not([style])').forEach(unwrap)

  return body.innerHTML.trim()
}
