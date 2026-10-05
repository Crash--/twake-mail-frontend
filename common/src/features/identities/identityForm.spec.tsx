import {
  allowedIdentityEmails,
  defaultSortOrderUpdates,
  parseIdentityAddresses,
  publicAssetIdsIn,
  signatureFromEditorHtml,
  signaturePreview,
  signatureToEditorHtml,
  validateIdentityName
} from './identityForm'

describe('identityForm', () => {
  it('validates the name as tmail-flutter does', () => {
    expect(validateIdentityName('')).toBe('identities.errors.blank')
    expect(validateIdentityName('   ')).toBe('identities.errors.onlySpaces')
    expect(validateIdentityName('Work')).toBe(null)
  })

  it('reads Reply-To and Bcc addresses separated by commas', () => {
    expect(parseIdentityAddresses('')).toEqual({ ok: true, value: [] })
    expect(
      parseIdentityAddresses('Bob <bob@example.com>, carol@example.com')
    ).toEqual({
      ok: true,
      value: [
        { name: 'Bob', email: 'bob@example.com' },
        { name: null, email: 'carol@example.com' }
      ]
    })
    expect(parseIdentityAddresses('bob@example.com, nope')).toEqual({
      ok: false,
      invalid: 'nope'
    })
  })

  it('offers the address of the account and those of the identities, once', () => {
    expect(
      allowedIdentityEmails(
        [
          { email: 'alice@example.com' },
          { email: 'alias@example.com' },
          { email: 'Alias@example.com' }
        ],
        'alice@example.com'
      )
    ).toEqual(['alice@example.com', 'alias@example.com'])
  })

  it('puts the new default identity first and the previous ones after', () => {
    expect(
      defaultSortOrderUpdates(
        [
          { id: 'server', sortOrder: 100 },
          { id: 'old-default', sortOrder: 0 },
          { id: 'target', sortOrder: 100 },
          { id: 'unsorted', sortOrder: undefined }
        ],
        'target'
      )
    ).toEqual({
      'old-default': { sortOrder: 100 },
      target: { sortOrder: 0 }
    })
  })

  it('keeps the PublicAsset of signature images through the editor', () => {
    const stored =
      '<p>Alice</p><img src="https://jmap.example.com/publicAsset/a/p1" public-asset-id="p1"><script>alert(1)</script>'

    const editorHtml = signatureToEditorHtml({
      htmlSignature: stored,
      textSignature: ''
    })

    expect(editorHtml).not.toContain('<script')
    expect(editorHtml).toContain('data-reference="p1"')
    const back = signatureFromEditorHtml(editorHtml)
    expect(back).toContain('public-asset-id="p1"')
    expect(back).not.toContain('data-reference')
    expect(publicAssetIdsIn(back)).toEqual(['p1'])
  })

  it('opens a text signature with its lines', () => {
    expect(
      signatureToEditorHtml({
        htmlSignature: '',
        textSignature: 'Alice\n<CEO>'
      })
    ).toBe('<p>Alice<br>&lt;CEO&gt;</p>')
  })

  it('previews a signature as one line of text', () => {
    expect(
      signaturePreview({
        htmlSignature: '<p>Alice</p><p><b>CEO</b><br>Twake</p>',
        textSignature: 'ignored'
      })
    ).toBe('Alice CEO Twake')
    expect(
      signaturePreview({ htmlSignature: '', textSignature: 'Alice\nCEO' })
    ).toBe('Alice CEO')
  })
})
