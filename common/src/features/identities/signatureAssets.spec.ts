import { signatureAssetChanges } from './signatureAssets'

describe('signatureAssetChanges', () => {
  it('releases removed images and destroys the unused new ones of an identity', () => {
    expect(
      signatureAssetChanges({
        before: ['kept', 'removed'],
        published: ['new-kept', 'new-removed'],
        saved: ['kept', 'new-kept', 'pasted'],
        isNewIdentity: false
      })
    ).toEqual({
      destroy: ['new-removed'],
      release: ['removed'],
      // Published images were tied to the identity when created
      tie: ['pasted']
    })
  })

  it('ties the images of a new identity once it exists', () => {
    expect(
      signatureAssetChanges({
        before: [],
        published: ['new-kept', 'new-removed'],
        saved: ['new-kept'],
        isNewIdentity: true
      })
    ).toEqual({ destroy: ['new-removed'], release: [], tie: ['new-kept'] })
  })
})
