import { contactName, uniqueContacts } from './contactNames'

const contact = (
  id: string,
  firstname: string,
  emailAddress: string
): {
  id: string
  firstname: string
  surname: string
  emailAddress: string
} => ({ id, firstname, surname: '', emailAddress })

describe('contactName', () => {
  it('joins the first name and the surname', () => {
    expect(
      contactName({
        firstname: 'Paul',
        surname: 'Known',
        emailAddress: 'paul@external.test'
      })
    ).toBe('Paul Known')
  })

  it('gives no name to a contact without one', () => {
    expect(contactName(contact('c', ' ', 'paul@external.test'))).toBe(null)
  })

  it('gives no name to a contact named after its address', () => {
    expect(
      contactName(contact('c', 'Paul@External.test', 'paul@external.test'))
    ).toBe(null)
  })
})

describe('uniqueContacts', () => {
  it('keeps one contact per address, the named one, where the first stood', () => {
    const collected = contact(
      'collected',
      'paul@external.test',
      'paul@external.test'
    )
    const other = contact('other', 'Jane', 'jane@external.test')
    const named = contact('named', 'Paul Known', 'PAUL@external.test')

    expect(uniqueContacts([collected, other, named])).toEqual([named, other])
  })

  it('keeps the first of two named contacts', () => {
    const first = contact('first', 'Paul', 'paul@external.test')
    const second = contact('second', 'Paul Known', 'paul@external.test')

    expect(uniqueContacts([first, second])).toEqual([first])
  })
})
