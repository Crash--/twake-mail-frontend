import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { EventCard } from './EventCard'
import { EventAnswerButton, EventTextAction } from './EventCardButtons'

describe('EventCard', () => {
  it('is a region named by its label, with its badge, its title as a heading and named details', () => {
    renderDs(
      <EventCard
        title="Weekly sync"
        label="Event: Weekly sync"
        badge={{
          state: 'created',
          content: (
            <>
              <strong>Olivia </strong>has invited you
            </>
          )
        }}
        badgeTestId="badge"
        date={{ month: 'Oct', day: '12' }}
        details={[
          { label: 'When', content: 'Monday at 10:00' },
          { label: 'Where', content: 'Room 42' }
        ]}
        actions={<button type="button">Yes</button>}
        trailing={<a href="https://calendar.example.com">Calendar</a>}
      />
    )

    const card = screen.getByRole('region', { name: 'Event: Weekly sync' })
    expect(
      within(card).getByRole('heading', { level: 2, name: 'Weekly sync' })
    ).toBeVisible()
    expect(within(card).getByTestId('badge')).toHaveTextContent(
      'Olivia has invited you'
    )
    expect(
      within(card)
        .getAllByRole('term')
        .map(term => term.textContent)
    ).toEqual(['When', 'Where'])
    expect(
      within(card)
        .getAllByRole('definition')
        .map(definition => definition.textContent)
    ).toEqual(['Monday at 10:00', 'Room 42'])
    expect(within(card).getByRole('button', { name: 'Yes' })).toBeVisible()
    expect(within(card).getByRole('link', { name: 'Calendar' })).toBeVisible()
  })

  it('leaves out the date icon, the badge and the details it has not', () => {
    renderDs(
      <EventCard
        title="No date"
        label="Event: No date"
        date={null}
        details={[]}
      />
    )

    expect(screen.queryByText('Oct')).toBe(null)
    expect(screen.queryByRole('term')).toBe(null)
  })
})

describe('EventAnswerButton', () => {
  it('is a toggle saying which answer is chosen', async () => {
    const onClick = jest.fn()
    renderDs(
      <>
        <EventAnswerButton isPressed onClick={onClick}>
          Yes
        </EventAnswerButton>
        <EventAnswerButton isPressed={false} onClick={onClick}>
          No
        </EventAnswerButton>
      </>
    )

    expect(screen.getByRole('button', { name: 'Yes' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await userEvent.click(screen.getByRole('button', { name: 'No' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('EventTextAction', () => {
  it('is a link opening a new tab with an href, a button without', () => {
    renderDs(
      <>
        <EventTextAction href="https://calendar.example.com/events/1">
          See in your Calendar
        </EventTextAction>
        <EventTextAction onClick={jest.fn()}>Mail to attendees</EventTextAction>
      </>
    )

    expect(
      screen.getByRole('link', { name: 'See in your Calendar' })
    ).toHaveAttribute('target', '_blank')
    expect(
      screen.getByRole('button', { name: 'Mail to attendees' })
    ).toBeVisible()
  })
})
