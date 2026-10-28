// `react-markdown`, `remark-gfm`, `remark-parse` and `unified` are ES modules
// only, with dozens of ES module dependencies (remark, micromark…).
// twake-mui imports them for its `Markdown` component and its
// `getPlainTextFromMarkdown` helper, which the app never uses: Jest gets
// this stand-in instead of transpiling them all (see `moduleNameMapper`).
// A default export, as the modules it stands for.
// eslint-disable-next-line no-restricted-syntax
export default function markdownStub(): null {
  return null
}

interface Processor {
  use: () => Processor
}

/** `unified`, called when twake-mui loads: a processor that only chains */
export function unified(): Processor {
  const processor: Processor = { use: () => processor }
  return processor
}
