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
    await expect(settings.toast).toContainText('added from the recipient list')
    await expect(settings.forwardItems).toHaveText([bob.email])
    await expect(page.getByTestId('forward-warning-banner')).toHaveCount(0)

    // A copy stays in the Inbox unless turned off
    const localCopy = page
      .getByTestId('forward-local-copy-toggle')
      .getByRole('switch')
    await expect(localCopy).toBeChecked()
    // Switched once the server took it
    await localCopy.click()
    await expect(settings.toast).toContainText('Keep local copy disable.')
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
    await expect(
      settings.forwardItems.filter({ hasText: 'someone@elsewhere.test' })
    ).toContainText('External domain')
    await expectNoA11yViolations(page)

    for (const email of ['someone@elsewhere.test', bob.email]) {
      await page.getByRole('button', { name: `Remove ${email}` }).click()
      await expect(settings.confirmDialog).toContainText(
        `Do you want to delete email ${email}?`
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
})
