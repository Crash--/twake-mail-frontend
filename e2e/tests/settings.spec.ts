import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

/** A 1×1 PNG, as a signature image */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
)

test.describe('SET settings', () => {
  test(
    'SET-02 choosing the default identity with its radio',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      const mailbox = await new LoginPage(page).loginAs(user)
      const settings = await mailbox.openSettings()
      await settings.open('profiles')
      await expect(settings.heading).toHaveText('Profiles')

      await settings.createIdentity({ name: 'Default Identity 1' })
      await settings.createIdentity({ name: 'Default Identity 2' })
      await expectNoA11yViolations(page)

      await settings.setDefaultIdentity('Default Identity 1')
      await expect(settings.defaultRadio('Default Identity 1')).toBeChecked()
      await expect(settings.toast).toContainText(
        'Default identity setup successful'
      )
      await expect(settings.identityItems.first()).toHaveAttribute(
        'data-identity-name',
        'Default Identity 1'
      )

      await settings.setDefaultIdentity('Default Identity 2')
      await expect(settings.defaultRadio('Default Identity 2')).toBeChecked()
      await expect(
        settings.defaultRadio('Default Identity 1')
      ).not.toBeChecked()
      await expect
        .poll(async () =>
          Object.fromEntries(
            (await jmap.getIdentities()).map(identity => [
              identity.name,
              identity.sortOrder
            ])
          )
        )
        .toMatchObject({ 'Default Identity 1': 100, 'Default Identity 2': 0 })
    }
  )

  test('SET-04 an identity is created, edited and deleted', async ({
    page,
    user,
    jmap
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const settings = await mailbox.openSettings()

    await settings.createIdentity({
      name: 'Support',
      replyTo: 'Help desk <help@example.com>',
      bcc: 'archive@example.com',
      signature: 'The support team'
    })
    const support = settings.identity('Support')
    await expect(support).toContainText(
      'Reply to: Help desk <help@example.com>'
    )
    await expect(support).toContainText('Bcc: archive@example.com')
    await expect(support).toContainText('-- The support team')
    await expect(settings.toast).toContainText(
      'You have created a new identity'
    )
    await expect
      .poll(async () =>
        (await jmap.getIdentities()).find(
          identity => identity.name === 'Support'
        )
      )
      .toMatchObject({
        email: user.email,
        replyTo: [{ name: 'Help desk', email: 'help@example.com' }],
        bcc: [{ email: 'archive@example.com' }],
        htmlSignature: '<p>The support team</p>',
        textSignature: 'The support team'
      })

    // A wrong address is named, and nothing is saved
    await support.getByTestId('identity-edit-button').click()
    const dialog = settings.identityDialog
    await expect(dialog.getByTestId('identity-email-select')).toBeDisabled()
    await dialog.getByTestId('identity-bcc-input').fill('not an address')
    await dialog.getByTestId('save-identity-button').click()
    await expect(dialog.getByTestId('identity-bcc-input')).toBeFocused()
    await expect(dialog).toContainText('This email address invalid')
    await expectNoA11yViolations(page)

    await dialog.getByTestId('identity-bcc-input').fill('')
    await dialog.getByTestId('identity-name-input').fill('Support desk')
    await dialog.getByTestId('save-identity-button').click()
    await expect(dialog).toBeHidden()
    await expect(settings.toast).toContainText(
      'changed your identity successfully'
    )
    await expect(settings.identity('Support desk')).not.toContainText('Bcc:')

    // The identity of the account cannot be deleted
    await expect(
      settings.identity(user.email).getByTestId('identity-delete-button')
    ).toHaveCount(0)

    await settings
      .identity('Support desk')
      .getByTestId('identity-delete-button')
      .click()
    await expect(settings.confirmDialog).toContainText(
      'Are you sure you want to delete this identity?'
    )
    await settings.confirmDialog
      .getByTestId('confirm-dialog-confirm-button')
      .click()
    await expect(settings.toast).toContainText('Identity has been deleted')
    await expect(settings.identity('Support desk')).toHaveCount(0)
    await expect
      .poll(async () =>
        (await jmap.getIdentities()).map(identity => identity.name)
      )
      .not.toContain('Support desk')
  })

  test('SET-05 a signature image is published as a public asset', async ({
    page,
    user,
    jmap
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const settings = await mailbox.openSettings()
    await settings.createIdentityButton.click()
    const dialog = settings.identityDialog
    await dialog.getByTestId('identity-name-input').fill('With logo')
    await dialog.getByTestId('identity-signature-editor').click()
    await page.keyboard.type('Logo: ')
    const chooser = page.waitForEvent('filechooser')
    await dialog.getByRole('button', { name: 'Insert image' }).click()
    await (
      await chooser
    ).setFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG })
    await expect(
      dialog
        .getByTestId('identity-signature-editor')
        .locator('img[src*="/publicAsset/"]')
    ).toHaveCount(1)
    await dialog.getByTestId('save-identity-button').click()
    await expect(dialog).toBeHidden()

    const identity = await expect
      .poll(async () =>
        (await jmap.getIdentities()).find(
          candidate => candidate.name === 'With logo'
        )
      )
      .toBeDefined()
      .then(async () =>
        (await jmap.getIdentities()).find(
          candidate => candidate.name === 'With logo'
        )
      )
    const html = String(identity?.htmlSignature)
    const assetId = /public-asset-id="([^"]+)"/.exec(html)?.[1]
    expect(assetId).toBeDefined()
    const assets = await jmap.call('PublicAsset/get', { ids: [assetId] }, [
      'com:linagora:params:jmap:public:assets'
    ])
    expect(assets.list).toEqual([
      expect.objectContaining({
        id: assetId,
        contentType: 'image/png',
        identityIds: { [String(identity?.id)]: true }
      })
    ])
    // Served without authentication, as other mail clients load it
    const publicUri = String(
      (assets.list as { publicURI: string }[])[0]?.publicURI
    )
    expect(html).toContain(publicUri.replace(/^https?:\/\/[^/]+/, ''))
  })

  test(
    'SET-06 the settings open on a phone as a list of sections',
    { tag: '@mobile' },
    async ({ page, user }) => {
      const mailbox = await new LoginPage(page).loginAs(user)
      const settings = await mailbox.openSettings()
      const isDesktop = (page.viewportSize()?.width ?? 1280) >= 1200
      if (isDesktop) {
        await expect(settings.heading).toHaveText('Profiles')
        await expect(
          page.getByRole('navigation', { name: 'Settings' })
        ).toBeVisible()
      } else {
        await expect(settings.heading).toHaveText('Settings')
        await expect(settings.menuItem('keyboard-shortcuts')).toContainText(
          'Mailbox & email actions'
        )
      }
      await expectNoA11yViolations(page)

      await settings.open('keyboard-shortcuts')
      await expect(settings.heading).toHaveText('Keyboard shortcuts')
      await expect(settings.heading).toBeFocused()
      await expect(page).toHaveTitle(
        'Keyboard shortcuts - Settings - Twake Mail'
      )
      await expect(
        page.getByRole('switch', { name: 'Enable keyboard shortcuts' })
      ).toBeChecked()
      await expectNoA11yViolations(page)

      if (!isDesktop) {
        await settings.sectionBackButton.click()
        await expect(settings.heading).toHaveText('Settings')
      }
      await settings.backToMailButton.click()
      await expect(mailbox.root).toBeVisible()
    }
  )
})
