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
            getAttrs: (element: HTMLElement) =>
              hasKeptStyle(element) ? (rule.getAttrs?.(element) ?? null) : false
          }
        : rule
    )
  }
})
