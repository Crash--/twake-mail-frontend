/**
 * Every CSS rule of the document, as text: what Emotion injected for the
 * components rendered so far, through `<style>` contents or `insertRule`.
 * Whitespace is removed, so that tests compare compact rules.
 */
export function injectedCss(): string {
  return Array.from(document.styleSheets)
    .flatMap(sheet => Array.from(sheet.cssRules).map(rule => rule.cssText))
    .join('\n')
    .replace(/\s/g, '')
}
