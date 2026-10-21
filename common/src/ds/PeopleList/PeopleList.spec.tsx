import { screen, within } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { PeopleEmptyCard, PeopleList, PersonCard } from './PeopleList'

describe('PeopleList', () => {
  it('lists the people with their address and their action', () => {
    renderDs(
      <PeopleList
        label="Who has access"
        people={[
          {
            id: '1',
            name: 'Bob Assistant',
            address: 'bob@example.com',
            avatarKey: 'bob@example.com'
          },
          { id: '2', name: 'carol@example.com', avatarKey: 'carol@example.com' }
        ]}
        renderAction={person => (
          <button type="button">Remove {person.name}</button>
        )}
      />
    )

    const list = screen.getByRole('list', { name: 'Who has access' })
    const [bob, carol] = within(list).getAllByRole('listitem')
    expect(bob).toHaveTextContent('Bob Assistant')
    expect(bob).toHaveTextContent('bob@example.com')
    expect(carol).toHaveTextContent('carol@example.com')
    expect(
      within(list).getByRole('button', { name: 'Remove Bob Assistant' })
    ).toBeVisible()
  })

  it('shows one person in a card', () => {
    renderDs(
      <PersonCard
        person={{
          id: '1',
          name: 'Bob',
          address: 'bob@example.com',
          avatarKey: 'bob'
        }}
        data-testid="card"
      />
    )

    expect(screen.getByTestId('card')).toHaveTextContent('Bobbob@example.com')
  })

  it('says the list is empty, with its action', () => {
    renderDs(
      <PeopleEmptyCard
        title="No one yet"
        text="Add someone"
        action={<button type="button">Add</button>}
      />
    )

    expect(screen.getByText('No one yet')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Add' })).toBeVisible()
  })
})
