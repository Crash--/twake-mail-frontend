import { requestVersionCheck } from '@linagora/twake-react-new-version'

import { failedChunk } from './failedChunk'

jest.mock('@linagora/twake-react-new-version', () => ({
  requestVersionCheck: jest.fn()
}))

describe('failedChunk', () => {
  it('asks for a version check and fails as the import did', () => {
    const error = new Error('Loading chunk 42 failed')

    expect(() => failedChunk(error)).toThrow(error)
    expect(requestVersionCheck).toHaveBeenCalledTimes(1)
  })
})
