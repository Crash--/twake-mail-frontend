import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { convertIcuMessage, parseIcuMessage } from './icuToPolyglot.mjs'

describe('convertIcuMessage', () => {
  it('keeps plain text', () => {
    assert.equal(convertIcuMessage('Compose', 'en').phrase, 'Compose')
  })

  it('turns placeholders into Polyglot placeholders', () => {
    const { phrase, pluralVariable } = convertIcuMessage(
      'Unexpected error: {errorMessage}',
      'en'
    )
    assert.equal(phrase, 'Unexpected error: %{errorMessage}')
    assert.equal(pluralVariable, null)
  })

  it('unescapes ICU quotes', () => {
    assert.equal(
      convertIcuMessage("It''s '{literal}' don't", 'en').phrase,
      "It's {literal} don't"
    )
  })

  it('converts an English plural into two forms using smart_count', () => {
    const { phrase, pluralVariable, warnings } = convertIcuMessage(
      '{count,plural, =1{1 message has been deleted}other{{count} messages have been deleted}}',
      'en'
    )
    assert.equal(
      phrase,
      '1 message has been deleted |||| %{smart_count} messages have been deleted'
    )
    assert.equal(pluralVariable, 'count')
    assert.deepEqual(warnings, [])
  })

  it('uses the three Russian forms, falling back to other', () => {
    const { phrase } = convertIcuMessage(
      '{n, plural, one{# письмо} other{# писем}}',
      'ru'
    )
    assert.equal(
      phrase,
      '%{smart_count} письмо |||| %{smart_count} писем |||| %{smart_count} писем'
    )
  })

  it('keeps a single form for Vietnamese', () => {
    assert.equal(
      convertIcuMessage('{n, plural, one{# thư} other{# thư}}', 'vi').phrase,
      '%{smart_count} thư'
    )
  })

  it('repeats the text around the plural block in each form', () => {
    assert.equal(
      convertIcuMessage(
        'Deleted{days,plural, =1{ (1 day ago)}other{ ({days} days ago)}}!',
        'en'
      ).phrase,
      'Deleted (1 day ago)! |||| Deleted (%{smart_count} days ago)!'
    )
  })

  it('warns when an explicit =0 form is dropped', () => {
    const { warnings } = convertIcuMessage(
      '{days,plural, =0{}=1{yesterday}other{{days} days ago}}',
      'fr'
    )
    assert.equal(warnings.length, 1)
  })

  it('reads the variable pluralized elsewhere from smart_count', () => {
    const { phrase, warnings } = convertIcuMessage(
      '{count} messages ont été supprimés',
      'fr',
      { pluralVariable: 'count' }
    )
    assert.equal(phrase, '%{smart_count} messages ont été supprimés')
    assert.equal(warnings.length, 1)
  })

  it('rejects select arguments', () => {
    assert.throws(() =>
      parseIcuMessage('{gender, select, male{he} other{they}}')
    )
  })
})
