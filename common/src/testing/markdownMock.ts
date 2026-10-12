// `react-markdown` and `remark-gfm` are ES modules only, with dozens of ES
// module dependencies (unified, remark, micromark…). twake-mui imports them
// for its `Markdown` component, which the app never renders: Jest gets this
// stand-in instead of transpiling them all (see `moduleNameMapper`).
// A default export, as the modules it stands for.
// eslint-disable-next-line no-restricted-syntax
export default function markdownStub(): null {
  return null
}
