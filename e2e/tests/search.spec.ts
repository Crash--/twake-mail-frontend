import { LoginPage, SearchPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'
import type { Email, JmapClient } from '../support/jmap'

const USERNAMES = ['Alice', 'Brian', 'Charlotte', 'David', 'Emma'] as const

/** "<Name> send Bob", the emails of tmail-flutter's sort order fixtures */
async function importSortOrderEmails(jmap: JmapClient): Promise<string[]> {
  const subjects: string[] = []
  for (let index = 0; index < USERNAMES.length; index++) {
    const email = await jmap.importEml(
      `search_email_with_sort_order/${index}.eml`
    )
    subjects.push(email.subject ?? '')
  }
  return subjects
}

/**
 * Waits for an email in the inbox without searching: the memory backend
 * misses subjects of more than a few words
 */
async function waitInInbox(jmap: JmapClient, subject: string): Promise<Email> {
  const inbox = await jmap.findMailboxByRole('inbox')
  let found: Email | undefined
  await expect
    .poll(async () => {
      found = (await jmap.queryEmails({ inMailbox: inbox.id })).find(
        email => email.subject === subject
      )
      return found !== undefined
    })
    .toBe(true)
  if (found === undefined) throw new Error(`No email ${subject}`)
  return found
}

/** The subjects of a search as the server sorts them */
async function serverOrder(
  jmap: JmapClient,
  text: string,
  sort: { property: string; isAscending: boolean }
): Promise<string[]> {
  const accountId = await jmap.accountId()
  const responses = await jmap.request([
    ['Email/query', { accountId, filter: { text }, sort: [sort] }, 'q'],
    [
      'Email/get',
      {
        accountId,
        '#ids': { resultOf: 'q', name: 'Email/query', path: '/ids' },
        properties: ['subject']
      },
      'g'
    ]
  ])
  const query = responses.find(([name]) => name === 'Email/query')?.[1]
  const get = responses.find(([name]) => name === 'Email/get')?.[1]
  const ids = Array.isArray(query?.ids) ? query.ids.map(String) : []
  const list = Array.isArray(get?.list) ? get.list : []
  const subjects = new Map<string, string>()
  for (const item of list) {
    if (
      typeof item === 'object' &&
      item !== null &&
      'id' in item &&
      'subject' in item
    ) {
      subjects.set(String(item.id), String(item.subject))
    }
  }
  return ids.map(id => subjects.get(id) ?? '')
}

test.describe('SRCH search', () => {
  test('SRCH-01 a subject with angle brackets shows as typed in the results', async ({
    page,
    user,
    jmap
  }) => {
    const subject = '<Search snippets html escape>'
    await jmap.sendEmail({
      to: user.email,
      saveTo: 'trash',
      subject,
      text: 'Search snippets body'
    })
    await waitInInbox(jmap, subject)

    await new LoginPage(page).loginAs(user)
    // The memory backend misses longer queries (e2e/README.md)
    const search = await new SearchPage(page).search('snippets html escape')

    await expect(search.resultRow(subject)).toBeVisible()
    await expect(
      search.resultRow(subject).getByTestId('email-list-item-subject')
    ).toHaveText(subject)
    await expectNoA11yViolations(page)
  })

  test('SRCH-02 the searched word is highlighted in the subjects and previews', async ({
    page,
    user,
    jmap
  }) => {
    const subject = 'Search snippet results'
    const filler = 'lorem ipsum dolor sit amet '.repeat(4)
    await jmap.sendEmail({
      to: user.email,
      saveTo: 'trash',
      subject,
      text: `Search at the start. ${filler}`
    })
    await jmap.sendEmail({
      to: user.email,
      saveTo: 'trash',
      subject,
      text: `${filler} Search in the middle. ${filler}`,
      attachments: [
        { name: 'Search.txt', type: 'text/plain', content: 'attached' }
      ]
    })
    await jmap.sendEmail({
      to: user.email,
      saveTo: 'trash',
      subject,
      text: `${filler} at the end, Search`
    })
    await expect
      .poll(async () => (await jmap.queryEmails({ text: 'Search' })).length)
      .toBeGreaterThanOrEqual(3)

    await new LoginPage(page).loginAs(user)
    const search = await new SearchPage(page).search('Search')

    const rows = search.resultRow(subject)
    await expect(rows).toHaveCount(3)
    for (const row of await rows.all()) {
      await expect(
        row.getByTestId('email-list-item-subject').locator('mark')
      ).toHaveText('Search')
      await expect(
        row.getByTestId('email-list-item-preview').locator('mark').first()
      ).toHaveText(/search/i)
    }
    await expectNoA11yViolations(page)
  })

  test('SRCH-03 typing shows email suggestions with the word highlighted', async ({
    page,
    user,
    jmap
  }) => {
    const subject = 'Search snippet suggestions'
    await jmap.sendEmail({
      to: user.email,
      saveTo: 'trash',
      subject,
      text: 'Search at the start'
    })
    await jmap.sendEmail({
      to: user.email,
      saveTo: 'trash',
      subject,
      text: 'In the middle, Search, of the body'
    })
    await jmap.waitForEmail({ subject })

    await new LoginPage(page).loginAs(user)
    const search = await new SearchPage(page).type('Search')

    await expect(search.suggestions).toBeVisible()
    await expect(search.input).toHaveAttribute('aria-expanded', 'true')
    await expect(search.suggestionItems.first()).toBeVisible()
    await expect(
      search.suggestionItems.first().locator('mark').first()
    ).toHaveText(/search/i)

    // The arrows move the active option, the field keeps the focus
    await search.input.press('ArrowDown')
    await expect(search.input).toHaveAttribute('aria-activedescendant', /.+/)
    await expect(search.input).toBeFocused()
    await expectNoA11yViolations(page)

    await search.input.press('Escape')
    await expect(search.suggestions).toBeHidden()
    await expect(search.input).toHaveAttribute('aria-expanded', 'false')
  })

  test('SRCH-04 a quick filter picked in the suggestions applies on submit', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({
      to: user.email,
      saveTo: 'trash',
      subject: 'Quicksearchsuggestion attached',
      text: 'with a file',
      attachments: [{ name: 'note.txt', type: 'text/plain', content: 'hello' }]
    })
    await jmap.sendEmail({
      to: user.email,
      saveTo: 'trash',
      subject: 'Quicksearchsuggestion plain',
      text: 'no file'
    })
    await jmap.waitForEmail({ subject: 'Quicksearchsuggestion plain' })

    await new LoginPage(page).loginAs(user)
    const search = await new SearchPage(page).type('Quicksearchsuggestion')
    await search.quickFilter('has-attachment').click()

    await expect(search.quickFilter('has-attachment')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(search.input).toBeFocused()
    await search.input.press('Enter')

    await expect(
      search.resultRow('Quicksearchsuggestion attached')
    ).toBeVisible()
    await expect(search.resultRow('Quicksearchsuggestion plain')).toBeHidden()
    await expect(search.filterChip('has-attachment')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  test('SRCH-05 a quick filter picked in the suggestions is checked in the advanced search', async ({
    page,
    user
  }) => {
    await new LoginPage(page).loginAs(user)
    const search = await new SearchPage(page).type('Quicksearchsuggestion')
    await search.quickFilter('has-attachment').click()

    const dialog = await search.openAdvanced()

    await expect(
      dialog.getByRole('checkbox', { name: 'Has attachment' })
    ).toBeChecked()
    await expect(dialog.getByTestId('advanced-search-text-input')).toHaveValue(
      'Quicksearchsuggestion'
    )
    await expectNoA11yViolations(page)
  })

  test('SRCH-06 the filters stay when the searched text changes', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({
      to: user.email,
      saveTo: 'trash',
      subject: 'Persist search filter',
      text: 'kept',
      attachments: [{ name: 'note.txt', type: 'text/plain', content: 'hello' }]
    })
    await jmap.sendEmail({
      to: user.email,
      saveTo: 'trash',
      subject: 'Persist search plain',
      text: 'no file'
    })
    await jmap.waitForEmail({ subject: 'Persist search plain' })

    await new LoginPage(page).loginAs(user)
    const search = await new SearchPage(page).search('Persist search filter')
    await search.filterChip('has-attachment').click()
    await expect(search.filterChip('has-attachment')).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    await search.search('Persist search')

    await expect(search.filterChip('has-attachment')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expectNoA11yViolations(page)
    await expect(search.resultRow('Persist search filter')).toBeVisible()
    await expect(search.resultRow('Persist search plain')).toBeHidden()
  })

  test('SRCH-07 search by label', async () => {
    test.fixme(
      true,
      'Labels (Label/get, com:linagora:params:jmap:labels) come with phase 4: no label filter yet'
    )
  })

  test('SRCH-08 search by tag from the labels filter', async () => {
    test.fixme(
      true,
      'Labels (Label/get, com:linagora:params:jmap:labels) come with phase 4: no label filter yet'
    )
  })

  test('SRCH-09 last 7 days sorted by relevance lists the emails sent to five people', async ({
    page,
    user,
    users,
    jmap
  }) => {
    for (const name of USERNAMES) {
      const recipient = await users.create({ prefix: name.toLowerCase() })
      await jmap.sendEmail({
        to: recipient.email,
        subject: `relevance ${name}`,
        text: 'relevance'
      })
    }
    await expect
      .poll(async () => (await jmap.queryEmails({ text: 'relevance' })).length)
      .toBe(USERNAMES.length)

    await new LoginPage(page).loginAs(user)
    const search = await new SearchPage(page).search('relevance')
    await search.pickFilter('date-time', 'Last 7 days')
    await search.pickFilter('sort-by', 'Relevance')

    await expect(search.emailList.getByTestId('email-list-item')).toHaveCount(
      USERNAMES.length
    )
    expect(page.url()).toContain('date=last7Days')
  })

  test('SRCH-10 results are sorted by relevance by default', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({
      to: user.email,
      saveTo: 'trash',
      subject: 'Relevance by default',
      text: 'body'
    })
    await jmap.waitForEmail({ subject: 'Relevance by default' })

    await new LoginPage(page).loginAs(user)
    const search = await new SearchPage(page).search('Relevance by default')

    await expect(search.filterChip('sort-by')).toHaveText('Relevance')
    await expect(search.resultRow('Relevance by default')).toBeVisible()
  })

  test('SRCH-11 each sort order lists the results in its order', async ({
    page,
    user,
    jmap
  }) => {
    const subjects = await importSortOrderEmails(jmap)

    await new LoginPage(page).loginAs(user)
    const search = await new SearchPage(page).search('hello')
    await expect(search.emailList.getByTestId('email-list-item')).toHaveCount(5)

    const orders: [
      string,
      { property: string; isAscending: boolean },
      string[] | null
    ][] = [
      [
        'Most recent',
        { property: 'receivedAt', isAscending: false },
        [...subjects].reverse()
      ],
      ['Oldest', { property: 'receivedAt', isAscending: true }, subjects],
      ['Sender name: A - Z', { property: 'from', isAscending: true }, subjects],
      [
        'Sender name: Z - A',
        { property: 'from', isAscending: false },
        [...subjects].reverse()
      ],
      ['Subject: A - Z', { property: 'subject', isAscending: true }, subjects],
      [
        'Subject: Z - A',
        { property: 'subject', isAscending: false },
        [...subjects].reverse()
      ],
      ['Size ascending', { property: 'size', isAscending: true }, null],
      ['Size descending', { property: 'size', isAscending: false }, null]
    ]
    for (const [label, sort, expected] of orders) {
      await search.pickFilter('sort-by', label)
      await expect(search.filterChip('sort-by')).toHaveText(label)
      const order = expected ?? (await serverOrder(jmap, 'hello', sort))
      await expect.poll(() => search.resultSubjects()).toEqual(order)
    }
    await search.pickFilter('sort-by', 'Relevance')
    await expect(search.emailList.getByTestId('email-list-item')).toHaveCount(5)
  })

  test('SRCH-12 the sort order picked before applies to a new search', async ({
    page,
    user,
    jmap
  }) => {
    const subjects = await importSortOrderEmails(jmap)
    await page.addInitScript(() => {
      window.localStorage.setItem('twake-mail.search.sort-order', 'oldest')
    })

    await new LoginPage(page).loginAs(user)
    const search = await new SearchPage(page).search('hello')

    await expect(search.filterChip('sort-by')).toHaveText('Oldest')
    await expect.poll(() => search.resultSubjects()).toEqual(subjects)
  })

  test('SRCH-13 reading or archiving a result shows its new state in the results', async ({
    page,
    user,
    jmap
  }) => {
    const subject = 'Mobile Search action state sync'
    await jmap.sendEmail({
      to: user.email,
      saveTo: 'trash',
      subject,
      text: 'state sync'
    })
    const email = await waitInInbox(jmap, subject)
    await jmap.setKeywords(email.id, { $seen: false })

    await new LoginPage(page).loginAs(user)
    // The memory backend misses longer queries (e2e/README.md)
    const search = await new SearchPage(page).search('action state sync')
    const row = search.resultRow(subject)
    await expect(row).toHaveAttribute('data-unread', 'true')
    await expectNoA11yViolations(page)

    await row.hover()
    await row.getByTestId('email-list-item-toggle-seen').click()
    await expect(row).not.toHaveAttribute('data-unread')
    await expect
      .poll(async () => (await jmap.getEmail(email.id)).keywords.$seen)
      .toBe(true)

    // TODO: archive from the selection toolbar once the email actions land
    // (phase 2, lot A); meanwhile another client archives it, push brings it
    const archive = await jmap.findMailboxByRole('archive')
    const inbox = await jmap.findMailboxByRole('inbox')
    const accountId = await jmap.accountId()
    await jmap.request([
      [
        'Email/set',
        {
          accountId,
          update: {
            [email.id]: {
              [`mailboxIds/${inbox.id}`]: null,
              [`mailboxIds/${archive.id}`]: true
            }
          }
        },
        'move'
      ]
    ])

    await expect(row.getByTestId('email-list-item-mailbox')).toContainText(
      'Archive'
    )
    await expect(search.results).toBeVisible()
  })

  test('SRCH-14 the search field is not focused on load, a right click focuses it', async ({
    page,
    user
  }) => {
    await new LoginPage(page).loginAs(user)
    const search = new SearchPage(page)
    await expect(search.input).toBeVisible()
    await expect(search.input).not.toBeFocused()

    await search.input.click({ button: 'right' })

    await expect(search.input).toBeFocused()
  })
})
