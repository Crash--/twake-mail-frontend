import { isComposeEmbedPath } from './composeEmbedPath'

describe('isComposeEmbedPath', () => {
  it.each([
    '/embed/compose',
    '/embed/compose/',
    '/embed/compose?uri=mailto%3Abob%40example.com'
  ])('is true for %s', path => {
    expect(isComposeEmbedPath(path)).toBe(true)
  })

  it.each(['/mailto', '/embed/composer', '/embed/compose/other', '/'])(
    'is false for %s',
    path => {
      expect(isComposeEmbedPath(path)).toBe(false)
    }
  )
})
