import { getStyleProperty, isValidCSSStyleValue } from '@tiptap/core'
import { TextStyle } from '@tiptap/extension-text-style'
import type { ParseRule, TagParseRule } from '@tiptap/pm/model'

/**
 * The style properties the editor keeps on a span (Color, BackgroundColor,
 * FontFamily, FontSize of TextStyleKit, line height off), each with the
 * cleaning its attribute parser applies before rendering it
 */
const KEPT_PROPERTIES: readonly {
  name: string
  clean: (value: string) => string
}[] = [
  { name: 'color', clean: value => value.replace(/['"]+/g, '') },
  { name: 'background-color', clean: value => value.replace(/['"]+/g, '') },
  { name: 'font-family', clean: value => value },
  { name: 'font-size', clean: value => value }
]

function hasKeptStyle(element: HTMLElement): boolean {
  return KEPT_PROPERTIES.some(({ name, clean }) => {
    const value =
      getStyleProperty(element, name) ?? element.style.getPropertyValue(name)
    return isValidCSSStyleValue(clean(value))
  })
}

/**
 * Rewrites the span's `style` attribute as the CSSOM serialises it, which is
 * how ProseMirror writes a mark back (`dom.style.cssText`). The attribute
 * parsers read the raw text, so `#1F497D` and `#1f497d` were two marks
 * written identically, merged by the next load: a reopened draft changed
 * (issue #935). Parsing the serialised value makes the marks equal at once.
 * The trailing `;` goes: TextStyle prefixes a nested span's style with
 * `${parentStyle};`, and some CSS parsers (jsdom) drop what follows `;;`.
 */
function normaliseStyle(element: HTMLElement): void {
  if (element.hasAttribute('style')) {
    element.setAttribute('style', element.style.cssText.replace(/;\s*$/, ''))
  }
}

function isTagRule(rule: ParseRule): rule is TagParseRule {
  return 'tag' in rule
}

/**
 * TextStyle whose span rule only matches a span with a style the editor
 * keeps. tiptap's matches any `style` attribute: a quoted
 * `<span style="font-weight:bold">` became a mark with empty attributes,
 * written as a bare `<span>` that the next load drops, so a reopened draft
 * changed (issue #779). Such a span now leaves its text unstyled.
 */
export const KeptTextStyle = TextStyle.extend({
  parseHTML() {
    return (this.parent?.() ?? []).map(rule =>
      isTagRule(rule)
        ? {
            ...rule,
            getAttrs: (element: HTMLElement) => {
              normaliseStyle(element)
              return hasKeptStyle(element)
                ? (rule.getAttrs?.(element) ?? null)
                : false
            }
          }
        : rule
    )
  }
})
