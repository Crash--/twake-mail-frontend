/**
 * @jest-environment jsdom
 */
import {
  FIT_SCALED_CLASS,
  FIT_ZOOM_PROPERTY,
  fitEmailLayout,
  fitScale,
  hasFixedWidth,
  isLength,
  proportion,
  wrappableWhiteSpace,
  type LayoutProbe
} from './fitEmailLayout'

const CONTENT_WIDTH = 600

/** A width in pixels or a percentage of `room`, null for `auto` */
function parseWidth(value: string, room: number): number | null {
  if (value === '' || value === 'auto') return null
  if (value.endsWith('%')) return (parseFloat(value) / 100) * room
  const pixels = parseFloat(value)
  return Number.isNaN(pixels) ? null : pixels
}

function declaredWidth(element: HTMLElement, room: number): number | null {
  return parseWidth(
    element.style.width || (element.getAttribute('width') ?? ''),
    room
  )
}

/**
 * jsdom has no layout: a small model of the one of a browser. A block fills
 * its parent unless it has a width, `max-width` caps it, `min-width` wins;
 * a table cannot be narrower than what its cells force (their fixed widths in
 * pixels, side by side in a row, and `data-min`, content that cannot wrap);
 * padding adds to a width unless `box-sizing: border-box`; `zoom` scales
 * the box, a percentage being resolved in the zoomed box (`data-zoom-extra`:
 * pixels that do not scale); a height (and its min and max) in pixels adds the
 * padding and the borders unless `box-sizing: border-box`, `data-height` being
 * the one of the text. `data-scroll` is the width of the text of an element,
 * overflowing it when it cannot wrap
 */
function fakeProbe(
  content: HTMLElement
): LayoutProbe & { height: (element: Element) => number } {
  const intrinsic = (element: HTMLElement): number => {
    const own = Math.max(
      declaredWidth(element, 0) ?? 0,
      parseWidth(element.style.minWidth, 0) ?? 0,
      Number(element.dataset.min ?? 0)
    )
    const children = Array.from(element.children).map(child =>
      child instanceof HTMLElement ? intrinsic(child) : 0
    )
    const fromChildren =
      element.tagName === 'TR'
        ? children.reduce((sum, width) => sum + width, 0)
        : Math.max(0, ...children)
    return Math.max(own, fromChildren)
  }
  const width = (element: Element): number => {
    if (element === content) return CONTENT_WIDTH
    if (!(element instanceof HTMLElement || element instanceof SVGElement)) {
      return 0
    }
    const parent = element.parentElement
    const room = parent === null ? CONTENT_WIDTH : width(parent)
    const zoomValue = parseFloat(
      element.style.getPropertyValue(FIT_ZOOM_PROPERTY)
    )
    const zoom = Number.isNaN(zoomValue) ? 1 : zoomValue
    // Percentages and auto widths are resolved in the zoomed box
    const ownRoom = room / zoom
    const htmlElement = element instanceof HTMLElement ? element : null
    const declared =
      htmlElement === null
        ? parseWidth(element.getAttribute('width') ?? '', ownRoom)
        : declaredWidth(htmlElement, ownRoom)
    const padding =
      (parseWidth(element.style.paddingLeft, 0) ?? 0) +
      (parseWidth(element.style.paddingRight, 0) ?? 0)
    const borderBox = element.style.boxSizing === 'border-box'
    const cap = parseWidth(element.style.maxWidth, ownRoom) ?? Infinity
    let used =
      declared === null
        ? ownRoom
        : Math.min(declared, cap) + (borderBox ? 0 : padding)
    used = Math.max(used, parseWidth(element.style.minWidth, ownRoom) ?? 0)
    if (htmlElement !== null && element.tagName === 'TABLE') {
      const forced = Array.from(htmlElement.children).map(child =>
        child instanceof HTMLElement ? intrinsic(child) : 0
      )
      used = Math.max(used, Number(htmlElement.dataset.min ?? 0), ...forced)
    }
    // What does not scale with the zoom (rounded borders, text)
    const extra =
      zoom !== 1 && htmlElement !== null
        ? Number(htmlElement.dataset.zoomExtra ?? 0)
        : 0
    return (used + extra) * zoom
  }
  const edges = (element: HTMLElement): number =>
    (parseWidth(element.style.paddingTop, 0) ?? 0) +
    (parseWidth(element.style.paddingBottom, 0) ?? 0) +
    2 * (parseFloat(element.style.borderWidth) || 0)
  const height = (element: Element): number => {
    if (!(element instanceof HTMLElement)) return 0
    const borderBox = element.style.boxSizing === 'border-box'
    const declared = parseFloat(element.style.height)
    const text = Number(element.dataset.height ?? 40)
    const min = parseFloat(element.style.minHeight) || 0
    const max = parseFloat(element.style.maxHeight) || Infinity
    const clamp = (natural: number): number =>
      Math.max(Math.min(natural, max), min)
    if (borderBox) {
      return clamp(Number.isNaN(declared) ? text + edges(element) : declared)
    }
    return clamp(Number.isNaN(declared) ? text : declared) + edges(element)
  }
  return {
    height,
    box: element => ({ left: 0, width: width(element) }),
    clientWidth: width,
    scrollWidth: element => {
      const text =
        element instanceof HTMLElement ? Number(element.dataset.scroll ?? 0) : 0
      const wraps =
        element instanceof HTMLElement &&
        wrappableWhiteSpace(element.style.whiteSpace) === null
      return Math.max(width(element), wraps ? 0 : text)
    },
    style: (element, property) => {
      if (!(element instanceof HTMLElement)) return ''
      const { style } = element
      switch (property) {
        case 'white-space':
          return style.whiteSpace || 'normal'
        case 'overflow-x':
          return style.overflowX || 'visible'
        case 'box-sizing':
          return style.boxSizing || 'content-box'
        case 'padding-top':
          return style.paddingTop || '0px'
        case 'padding-bottom':
          return style.paddingBottom || '0px'
        case 'border-top-width':
        case 'border-bottom-width':
          return style.borderWidth || '0px'
        case 'height': {
          const content =
            height(element) -
            (style.boxSizing === 'border-box' ? 0 : edges(element))
          return `${String(content)}px`
        }
        case 'min-height':
          return style.minHeight || '0px'
        case 'max-height':
          return style.maxHeight || 'none'
      }
    }
  }
}

function render(html: string): HTMLElement {
  document.body.innerHTML = `<div id="tmail-content">${html}</div>`
  const content = document.getElementById('tmail-content')
  if (content === null) throw new Error('no content')
  return content
}

function element(selector: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(selector)
  if (found === null) throw new Error(`no ${selector}`)
  return found
}

/** The zoom of a scaled element, '' when not scaled */
function zoomOf(scaled: HTMLElement): string {
  const zoom = scaled.style.getPropertyValue(FIT_ZOOM_PROPERTY)
  expect(scaled.classList.contains(FIT_SCALED_CLASS)).toBe(zoom !== '')
  return zoom
}

function fit(content: HTMLElement): () => void {
  return fitEmailLayout(content, fakeProbe(content))
}

describe('wrappableWhiteSpace', () => {
  it('lets a nowrap text wrap and a preformatted one wrap with its spaces', () => {
    expect(wrappableWhiteSpace('nowrap')).toBe('normal')
    expect(wrappableWhiteSpace('pre')).toBe('pre-wrap')
  })

  it('leaves the text that already wraps', () => {
    expect(wrappableWhiteSpace('normal')).toBe(null)
    expect(wrappableWhiteSpace('pre-wrap')).toBe(null)
    expect(wrappableWhiteSpace('pre-line')).toBe(null)
  })
})

describe('hasFixedWidth', () => {
  it('is true for a width in pixels, by attribute or inline style', () => {
    render(
      '<table id="a" width="900"></table><div id="b" style="width: 1200px"></div><div id="c" style="width: 40em"></div>'
    )
    expect(hasFixedWidth(element('#a'))).toBe(true)
    expect(hasFixedWidth(element('#b'))).toBe(true)
    expect(hasFixedWidth(element('#c'))).toBe(true)
  })

  it('is false for a percentage or no width', () => {
    render(
      '<table id="a" width="100%"></table><div id="b" style="width: 50%"></div><div id="c"></div>'
    )
    expect(hasFixedWidth(element('#a'))).toBe(false)
    expect(hasFixedWidth(element('#b'))).toBe(false)
    expect(hasFixedWidth(element('#c'))).toBe(false)
  })
})

describe('isLength', () => {
  it('accepts a number with a unit', () => {
    expect(['69px', '4.5em', '.5rem', '10vh'].map(isLength)).toEqual([
      true,
      true,
      true,
      true
    ])
  })

  it('refuses a percentage, a keyword or nothing', () => {
    expect(
      ['', '50%', 'auto', 'fit-content', 'max-content', 'inherit', 'unset'].map(
        isLength
      )
    ).toEqual([false, false, false, false, false, false, false])
  })
})

describe('fitScale', () => {
  it('brings a wide element into the room it has', () => {
    expect(fitScale(1200, 600)).toBe(0.5)
    expect(fitScale(900, 360)).toBe(0.4)
  })

  it('rounds down so that the result never overflows', () => {
    const scale = fitScale(900, 600)
    expect(scale).toBe(0.6666)
    expect(900 * scale).toBeLessThanOrEqual(600)
  })

  it('leaves what fits, sub-pixel rounding included, and an element without room', () => {
    expect(fitScale(600, 600)).toBe(1)
    expect(fitScale(600.8, 600)).toBe(1)
    expect(fitScale(400, 600)).toBe(1)
    expect(fitScale(400, 0)).toBe(1)
  })
})

describe('proportion', () => {
  it('turns a width into a percentage of its owner, at most 100 %', () => {
    expect(proportion(300, 900)).toBe('33.333%')
    expect(proportion(450, 900)).toBe('50.000%')
    expect(proportion(1000, 900)).toBe('100.000%')
  })
})

describe('fitEmailLayout', () => {
  it('leaves an email that fits as the sender wrote it', () => {
    const content = render(
      '<table id="t" width="500"><tr><td width="250">a</td><td width="250">b</td></tr></table><div id="d" style="width: 580px">text</div>'
    )
    const before = content.innerHTML

    fit(content)

    expect(content.innerHTML).toBe(before)
  })

  it('does nothing while the frame has no width', () => {
    const content = render('<div style="width: 1200px">text</div>')
    const before = content.innerHTML

    fitEmailLayout(content, {
      ...fakeProbe(content),
      clientWidth: () => 0
    })

    expect(content.innerHTML).toBe(before)
  })

  it('reflows a wrapper of fixed width to the width of the frame, without scaling it', () => {
    const content = render('<div id="w" style="width: 1200px">long text</div>')

    fit(content)

    const wrapper = element('#w')
    expect(wrapper.style.getPropertyValue('width')).toBe('100%')
    expect(wrapper.style.getPropertyPriority('width')).toBe('important')
    expect(wrapper.style.maxWidth).toBe('100%')
    expect(zoomOf(wrapper)).toBe('')
  })

  it('overrides a min-width that keeps a wrapper wide', () => {
    const content = render('<div id="w" style="min-width: 1200px">text</div>')

    fit(content)

    expect(element('#w').style.minWidth).toBe('0')
    expect(zoomOf(element('#w'))).toBe('')
  })

  it('reflows a padded wrapper of fixed width in its border box, without scaling it', () => {
    const content = render(
      '<div id="w" style="width: 1200px; padding: 8px">text</div>'
    )
    const probe = fakeProbe(content)

    fitEmailLayout(content, probe)

    expect(element('#w').style.boxSizing).toBe('border-box')
    expect(element('#w').style.width).toBe('100%')
    expect(zoomOf(element('#w'))).toBe('')
    expect(probe.box(element('#w')).width).toBe(CONTENT_WIDTH)
  })

  it('keeps the rendered height of a button of fixed height reflowed in its border box', () => {
    const content = render(
      '<div id="b" style="width: 1200px; height: 69px; padding: 12px 0; border: 1px solid">text</div>'
    )
    const probe = fakeProbe(content)
    const height = probe.height(element('#b'))

    fitEmailLayout(content, probe)

    expect(probe.box(element('#b')).width).toBe(CONTENT_WIDTH)
    expect(probe.height(element('#b'))).toBe(height)
  })

  it('keeps the rendered height of a button capped by a max-height', () => {
    const content = render(
      '<div id="b" data-height="80" style="width: 1200px; max-height: 69px; overflow: hidden; padding: 12px 0; border: 1px solid">text</div>'
    )
    const probe = fakeProbe(content)

    fitEmailLayout(content, probe)

    expect(probe.height(element('#b'))).toBe(95)
  })

  it('keeps the rendered height of a button held by a min-height', () => {
    const content = render(
      '<div id="b" data-height="10" style="width: 1200px; min-height: 69px; padding: 12px 0; border: 1px solid">text</div>'
    )
    const probe = fakeProbe(content)

    fitEmailLayout(content, probe)

    expect(probe.height(element('#b'))).toBe(95)
  })

  it('leaves a height given by a keyword to the browser', () => {
    const content = render(
      '<div id="b" style="width: 1200px; height: fit-content; padding: 12px 0; border: 1px solid">text</div>'
    )
    const probe = fakeProbe(content)

    fitEmailLayout(content, probe)

    expect(element('#b').style.height).toBe('fit-content')
  })

  it('gives a scaled element its natural width in pixels, which a percentage would not shrink', () => {
    const content = render(
      '<table id="t" style="min-width: 1400px"><tr><td style="min-width: 350px">a</td><td style="min-width: 350px">b</td><td style="min-width: 350px">c</td><td style="min-width: 350px">d</td></tr></table>'
    )
    const probe = fakeProbe(content)

    fitEmailLayout(content, probe)

    const table = element('#t')
    expect(table.style.width).toBe('1400px')
    expect(table.style.maxWidth).toBe('none')
    expect(zoomOf(table)).toBe(String(fitScale(1400, CONTENT_WIDTH)))
    expect(probe.box(table).width).toBeLessThanOrEqual(CONTENT_WIDTH)
  })

  it('corrects the zoom when the scaled layout is wider than the zoom says', () => {
    const content = render(
      '<table id="t" data-zoom-extra="40"><tr><td style="min-width: 700px">a</td><td style="min-width: 700px">b</td></tr></table>'
    )
    const probe = fakeProbe(content)

    fitEmailLayout(content, probe)

    const table = element('#t')
    expect(Number(zoomOf(table))).toBeLessThan(fitScale(1400, CONTENT_WIDTH))
    expect(probe.box(table).width).toBeLessThanOrEqual(CONTENT_WIDTH)
    expect(probe.box(table).width).toBeGreaterThan(CONTENT_WIDTH - 1)
  })

  it('reflows nested wrappers in one go', () => {
    const content = render(
      '<div id="outer" style="width: 1200px"><div id="inner" style="width: 1000px"><p id="p">text</p></div></div>'
    )

    fit(content)

    expect(element('#outer').style.width).toBe('100%')
    expect(element('#inner').style.width).toBe('100%')
    expect(zoomOf(element('#inner'))).toBe('')
  })

  it('reflows a table of fixed width, its cells keeping their proportions', () => {
    const content = render(
      '<table id="t" width="900"><tr><td id="a" width="300">a</td><td id="b" style="width: 600px">b</td></tr></table>'
    )

    fit(content)

    expect(element('#t').style.width).toBe('100%')
    expect(element('#a').style.width).toBe('33.333%')
    expect(element('#b').style.width).toBe('66.667%')
    expect(zoomOf(element('#t'))).toBe('')
  })

  it('reflows the tables inside a wrapper of fixed width', () => {
    const content = render(
      '<div id="w" style="width: 1000px"><table id="t" width="900"><tr><td width="900">a</td></tr></table></div>'
    )

    fit(content)

    expect(element('#w').style.width).toBe('100%')
    expect(element('#t').style.width).toBe('100%')
    expect(zoomOf(element('#t'))).toBe('')
  })

  it('scales down a table whose content cannot wrap, after trying to wrap it', () => {
    const content = render(
      '<table id="t" width="900"><tr><td id="cell" data-min="800">wide</td></tr></table>'
    )

    fit(content)

    const table = element('#t')
    expect(element('#cell').style.wordBreak).toBe('break-word')
    // Its natural width in pixels, which the zoom shrinks
    expect(table.style.width).toBe('800px')
    expect(zoomOf(table)).toBe('0.75')
  })

  it('scales down an image-less element that cannot reflow', () => {
    const content = render(
      '<svg id="s" width="1200" height="100"></svg><p>after</p>'
    )

    fit(content)

    expect(zoomOf(element('#s'))).toBe('0.5')
  })

  it('lets a nowrap or preformatted text that overflows its box wrap', () => {
    const content = render(
      '<div id="nowrap" style="white-space: nowrap" data-scroll="900">a long line</div><div id="pre" style="white-space: pre" data-scroll="900">code</div><div id="short" style="white-space: nowrap" data-scroll="100">short</div>'
    )

    fit(content)

    expect(element('#nowrap').style.whiteSpace).toBe('normal')
    expect(element('#nowrap').style.wordBreak).toBe('break-word')
    expect(element('#pre').style.whiteSpace).toBe('pre-wrap')
    expect(element('#short').style.whiteSpace).toBe('nowrap')
    expect(element('#short').style.wordBreak).toBe('')
  })

  it('leaves a block that scrolls by itself', () => {
    const content = render(
      '<div id="code" style="white-space: pre; overflow-x: auto" data-scroll="900">code</div>'
    )

    fit(content)

    expect(element('#code').style.whiteSpace).toBe('pre')
  })

  it('puts back the styles of the sender when undone, ready for another width', () => {
    const content = render(
      '<div id="w" style="width: 1200px !important; color: red">text</div><table id="t" width="900"><tr><td id="cell" data-min="800">wide</td></tr></table>'
    )

    const undo = fit(content)
    undo()

    expect(element('#w').style.getPropertyValue('width')).toBe('1200px')
    expect(element('#w').style.getPropertyPriority('width')).toBe('important')
    expect(element('#w').style.color).toBe('red')
    expect(zoomOf(element('#t'))).toBe('')
    expect(element('#t').style.width).toBe('')
    expect(element('#cell').style.wordBreak).toBe('')
    // The elements without a style of their own are left without one
    expect(
      Array.from(content.querySelectorAll('table *')).map(
        node => node.getAttribute('style') ?? ''
      )
    ).toEqual(['', '', ''])
    expect(element('#t').className).toBe('')
  })

  it('stays as the sender wrote it when the layout cannot be read', () => {
    const content = render('<div id="w" style="width: 1200px">text</div>')
    const probe = fakeProbe(content)
    let reads = 0

    fitEmailLayout(content, {
      ...probe,
      box: node => {
        reads += 1
        // Fails once the wrapper has been reflowed
        if (reads > 4) throw new Error('detached')
        return probe.box(node)
      }
    })

    expect(element('#w').style.width).toBe('1200px')
  })
})
