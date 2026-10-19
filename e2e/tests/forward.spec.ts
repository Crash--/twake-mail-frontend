import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

const FORWARD = 'com:linagora:params:jmap:forward'

test.describe('SET forwarding', () => {
  test('SET-07 forwarding to an address of the domain, then outside it after the warning', async ({
    page,
    user,
    users,
    jmap,
    jmapFor
  }) => {
    const bob = await users.create()
    const mailbox = await new LoginPage(page).loginAs(user)
    const settings = await mailbox.openSettings()
    await settings.open('forwarding')
    await expect(page.getByTestId('forward-local-copy-toggle')).toHaveCount(0)

    await settings.forwardInput.fill(bob.email)
    await page.getByTestId('forward-add-button').click()
    await expect(settings.toast).toContainText('added to the recipient list')
    // Its card holds the avatar of tmail-flutter, then the address
    await expect(settings.forwardItems).toContainText([bob.email])
    await expect(page.getByTestId('forward-warning-banner')).toHaveCount(0)

    // A copy stays in the Inbox unless turned off
    const localCopy = page
      .getByTestId('forward-local-copy-toggle')
      .getByRole('switch')
    await expect(localCopy).toBeChecked()
    // Switched once the server took it
    await localCopy.click()
    await expect(settings.toast).toContainText('Local copy disabled.')
    await expect(localCopy).not.toBeChecked()
    await expectNoA11yViolations(page)

    await jmap.sendEmail({
      to: user.email,
      subject: 'Forwarded to bob',
      text: 'Hi'
    })
    await jmapFor(bob).waitForEmail({ subject: 'Forwarded to bob' })

    // Outside the domain: the warning of the deployment (docker/app-env.js)
    await settings.forwardInput.fill('someone@elsewhere.test')
    await page.getByTestId('forward-add-button').click()
    await expect(settings.confirmDialog).toContainText(
      'Forwarding outside example.com breaks the e2e charter.'
    )
    await settings.confirmDialog
      .getByTestId('confirm-dialog-cancel-button')
      .click()
    await expect(settings.forwardItems).toHaveCount(1)
    await page.getByTestId('forward-add-button').click()
    await settings.confirmDialog
      .getByTestId('confirm-dialog-confirm-button')
      .click()
    await expect(settings.forwardItems).toHaveCount(2)
    await expect(page.getByTestId('forward-warning-banner')).toContainText(
      'Forwarding outside example.com breaks the e2e charter.'
    )
    // As tmail-flutter, an information icon named so marks it
    await expect(
      settings.forwardItems
        .filter({ hasText: 'someone@elsewhere.test' })
        .getByRole('img', { name: 'External domain' })
    ).toBeVisible()
    await expectNoA11yViolations(page)

    for (const email of ['someone@elsewhere.test', bob.email]) {
      await page.getByRole('button', { name: `Remove ${email}` }).click()
      await expect(settings.confirmDialog).toContainText(
        `Do you want to remove ${email}?`
      )
      await settings.confirmDialog
        .getByTestId('confirm-dialog-confirm-button')
        .click()
      await expect(
        settings.forwardItems.filter({ hasText: email })
      ).toHaveCount(0)
    }
    await expect
      .poll(async () => {
        const result = await jmap.call('Forward/get', { ids: ['singleton'] }, [
          FORWARD
        ])
        return (result.list as unknown[])[0]
      })
      .toMatchObject({ forwards: [] })
  })

  test(
    'SET-18 forwarding to a suggested contact and a pasted list at once, then removing a selection',
    { tag: '@mobile' },
    async ({ page, user, jmap, webadmin }) => {
      const stamp = Date.now()
      const zelda = `zelda-${stamp}@example.com`
      const bob = `bob-${stamp}@example.com`
      const carol = `carol-${stamp}@example.com`
      await webadmin.createDomainContact('example.com', {
        emailAddress: zelda,
        firstname: 'Zelda',
        surname: `Forward${stamp}`
      })
      try {
        const mailbox = await new LoginPage(page).loginAs(user)
        const settings = await mailbox.openSettings()
        await settings.open('forwarding')

        // Contacts of the domain are suggested as the user types
        await settings.forwardInput.click()
        await page.keyboard.type(`Forward${stamp}`)
        const suggestions = page.getByTestId('forward-suggestions')
        await expect(
          suggestions.getByRole('option', { name: /Zelda/ })
        ).toBeVisible()
        await expectNoA11yViolations(page)
        await page.keyboard.press('Enter')
        // A list typed (or pasted) becomes tags, an invalid one named so
        await page.keyboard.type(`${bob}, ${carol}; wrong,`)
        const chips = page.getByTestId('forward-recipient-chip')
        await expect(chips).toHaveText([zelda, bob, carol, 'wrong'])
        await expect(chips.last()).toHaveAccessibleName(
          'wrong, invalid address'
        )
        await page.getByTestId('forward-add-button').click()
        await expect(page.getByTestId('forward-input-error')).toHaveText(
          'Incorrect email format'
        )
        await expect(settings.forwardInput).toHaveAccessibleDescription(
          'Incorrect email format'
        )
        await expect(settings.forwardItems).toHaveCount(0)

        // Without the invalid one, one "Add recipient" adds all three
        await chips.last().click()
        await page.keyboard.press('Delete')
        await expect(chips).toHaveCount(3)
        await page.getByTestId('forward-add-button').click()
        await expect(settings.toast).toContainText('added to the recipient list')
        await expect(settings.forwardItems).toHaveCount(3)
        await expect(chips).toHaveCount(0)

        // Two selected, the count said, removed with one confirmation
        const checkbox = (email: string) =>
          page.getByRole('checkbox', { name: `Select ${email}` })
        await checkbox(zelda).click()
        await checkbox(bob).focus()
        await page.keyboard.press('Space')
        await expect(checkbox(bob)).toBeChecked()
        await expect(page.getByTestId('forward-selection-status')).toHaveText(
          '2 selected'
        )
        await expectNoA11yViolations(page)
        await page.getByTestId('forward-remove-selected-button').click()
        await settings.confirmDialog
          .getByTestId('confirm-dialog-confirm-button')
          .click()
        await expect(settings.forwardItems).toHaveCount(1)
        await expect(settings.forwardItems).toContainText([carol])
        await expect
          .poll(async () => {
            const result = await jmap.call(
              'Forward/get',
              { ids: ['singleton'] },
              [FORWARD]
            )
            return (result.list as unknown[])[0]
          })
          .toMatchObject({ forwards: [carol], localCopy: true })
      } finally {
        await webadmin.deleteDomainContact('example.com', zelda)
      }
    }
  )
})
