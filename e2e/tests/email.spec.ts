import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

/** A 1×1 PNG, served for the remote images */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)
const REMOTE_HOST = 'https://images.example.test'

function newsletter(name: string): string {
  return [
    `<p>${name} news</p>`,
    `<img src="${REMOTE_HOST}/${name}/pixel.png" alt="tracking pixel" width="10" height="10">`,
    `<div style="background-image: url(${REMOTE_HOST}/${name}/background.png)">Background</div>`
  ].join('')
}

const SENTENCE =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'

test.describe('EML reading an email', () => {
  // The reading view of a single email: the "Thread" setting off
  test.use({ emailsOneByOne: true })

  test('EML-01 an email with a short body shows its whole content', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'short content', text: SENTENCE })
    await jmap.waitForEmail({ subject: 'short content' })

    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail('short content')

    await expect(email.body()).toContainText(SENTENCE)
    await expect(email.from).toContainText(user.email)
    await expect(email.to).toContainText(user.email)
    await expectNoA11yViolations(page)
  })

  test('EML-03 a script in an email body never runs', async ({
    page,
    user,
    jmap
  }) => {
    const dialogs: string[] = []
    page.on('dialog', dialog => {
      dialogs.push(dialog.message())
      void dialog.dismiss()
    })
    await jmap.sendEmail({
      to: user.email,
      subject: 'xss content',
      html: '<p>Harmless text</p><script>alert("XSSRobot")</script><img src="x" onerror="alert(\'XSSRobot\')">'
    })
    await jmap.waitForEmail({ subject: 'xss content' })

    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail('xss content')

    await expect(email.body()).toContainText('Harmless text')
    expect(await email.body().innerHTML()).not.toMatch(/XSSRobot|<script|onerror/)
    expect(dialogs).toEqual([])
  })

  test(
    'EML-34 bare URLs and addresses of text and HTML emails are links',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      await jmap.sendEmail({
        to: user.email,
        subject: 'plain links',
        text: 'Docs at https://docs.example.test/start. Ask bob@example.com, or see <www.example.org>.'
      })
      await jmap.sendEmail({
        to: user.email,
        subject: 'html links',
        html: '<p>Read www.example.org, then <a href="https://kept.example.test/">https://kept.example.test/</a></p><pre><code>curl https://code.example.test</code></pre>'
      })
      await jmap.waitForEmail({ subject: 'plain links' })
      await jmap.waitForEmail({ subject: 'html links' })

      const mailbox = await new LoginPage(page).loginAs(user)
      const plain = await mailbox.openEmail('plain links')

      const docs = plain.bodyLink('https://docs.example.test/start')
      await expect(docs).toHaveAttribute('href', 'https://docs.example.test/start')
      await expect(docs).toHaveAttribute('target', '_blank')
      await expect(docs).toHaveAttribute('rel', 'noopener noreferrer')
      await expect(plain.bodyLink('www.example.org')).toHaveAttribute(
        'href',
        'https://www.example.org/'
      )
      await expectNoA11yViolations(page)

      // mailto: writes the message in the app, with the keyboard
      const composer = await plain.writeFromBodyLink('bob@example.com')
      await expect(
        composer.recipients('to').filter({ hasText: 'bob@example.com' })
      ).toBeVisible()
      await composer.close()

      await plain.back()
      const html = await mailbox.openEmail('html links')
      await expect(html.bodyLink('www.example.org')).toHaveAttribute(
        'href',
        'https://www.example.org/'
      )
      await expect(html.body().getByRole('link')).toHaveCount(2)
      await expect(html.body().locator('code')).toHaveText(
        'curl https://code.example.test'
      )
    }
  )

  test('EML-29 remote images wait for the user, then always show for a trusted sender', async ({
    page,
    user,
    jmap
  }) => {
    const requested: string[] = []
    const referrers: string[] = []
    await page.route(`${REMOTE_HOST}/**`, async route => {
      requested.push(new URL(route.request().url()).pathname)
      const referrer = route.request().headers().referer
      if (referrer !== undefined) referrers.push(referrer)
      await route.fulfill({ contentType: 'image/png', body: PNG })
    })
    await jmap.sendEmail({ to: user.email, subject: 'first newsletter', html: newsletter('first') })
    await jmap.waitForEmail({ subject: 'first newsletter' })
    await jmap.sendEmail({ to: user.email, subject: 'second newsletter', html: newsletter('second') })
    await jmap.waitForEmail({ subject: 'second newsletter' })

    const mailbox = await new LoginPage(page).loginAs(user)
    let email = await mailbox.openEmail('first newsletter')

    await expect(email.body()).toContainText('first news')
    await expect(email.remoteContentBanner).toBeVisible()
    await expectNoA11yViolations(page)
    expect(requested).toEqual([])

    await email.showRemoteContentButton.click()

    await expect(email.remoteContentBanner).toBeHidden()
    await expect
      .poll(() => [...requested].sort())
      .toEqual(['/first/background.png', '/first/pixel.png'])
    await expect
      .poll(() =>
        email
          .body()
          .getByAltText('tracking pixel')
          .evaluate(image => (image instanceof HTMLImageElement ? image.naturalWidth : 0))
      )
      .toBe(1)
    // The sender does not learn where the email is read
    expect(referrers).toEqual([])

    // Shown for this opening only: the banner comes back
    await email.back()
    email = await mailbox.openEmail('first newsletter')
    await expect(email.remoteContentBanner).toBeVisible()
    await email.alwaysShowRemoteContentButton.click()
    await email.back()

    email = await mailbox.openEmail('second newsletter')
    await expect(email.body()).toContainText('second news')
    await expect(email.remoteContentBanner).toBeHidden()
    await expect.poll(() => requested).toContain('/second/pixel.png')
  })

  test('EML-28 opening an unread email marks it read', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'to be read', text: 'hi' })
    const sent = await jmap.waitForEmail({ subject: 'to be read' })

    const mailbox = await new LoginPage(page).loginAs(user)
    await expect(mailbox.emailRow('to be read')).toHaveAttribute('data-unread', 'true')
    await expect(mailbox.folderUnreadCount({ role: 'inbox' })).toHaveText('1')

    const email = await mailbox.openEmail('to be read')
    await expect(mailbox.folderUnreadCount({ role: 'inbox' })).toBeHidden()
    await email.back()

    await expect(mailbox.emailRow('to be read')).not.toHaveAttribute('data-unread')
    await expect
      .poll(async () => (await jmap.getEmail(sent.id)).keywords)
      .toEqual(expect.objectContaining({ $seen: true }))
  })
})
