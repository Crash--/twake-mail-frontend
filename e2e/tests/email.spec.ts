import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

/** A 1×1 PNG, served for the remote images */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)
const REMOTE_HOST = 'https://images.example.test'
const PNG_DATA = `data:image/png;base64,${PNG.toString('base64')}`

function newsletter(name: string): string {
  return [
    `<p>${name} news</p>`,
    `<img src="${REMOTE_HOST}/${name}/pixel.png" alt="tracking pixel" width="10" height="10">`,
    `<div style="background-image: url(${REMOTE_HOST}/${name}/background.png)">Background</div>`
  ].join('')
}

/**
 * A newsletter from outside the domain of the user, as a message to import:
 * the remote content of the senders of the domain shows without asking
 */
function newsletterEml(name: string, to: string): Buffer {
  return Buffer.from(
    [
      'From: News <news@newsletter.example.org>',
      `To: ${to}`,
      `Subject: ${name} newsletter`,
      `Message-ID: <${name}-${Date.now()}@newsletter.example.org>`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      newsletter(name)
    ].join('\r\n'),
    'utf8'
  )
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
    await jmap.sendEmail({
      to: user.email,
      subject: 'short content',
      text: SENTENCE
    })
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
    expect(await email.body().innerHTML()).not.toMatch(
      /XSSRobot|<script|onerror/
    )
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
      await expect(docs).toHaveAttribute(
        'href',
        'https://docs.example.test/start'
      )
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
    await jmap.importEmlContent(newsletterEml('first', user.email))
    await jmap.importEmlContent(newsletterEml('second', user.email))
    await jmap.importEmlContent(newsletterEml('third', user.email))

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
          .evaluate(image =>
            image instanceof HTMLImageElement ? image.naturalWidth : 0
          )
      )
      .toBe(1)
    // The sender does not learn where the email is read
    expect(referrers).toEqual([])

    // Asked once per email: another layout mounts the reading view again,
    // and the banner does not come back
    const viewport = page.viewportSize()
    if (viewport === null) throw new Error('The page has no viewport')
    await page.setViewportSize({
      width: viewport.width < 1024 ? 1280 : 600,
      height: viewport.height
    })
    await expect(email.body()).toContainText('first news')
    await expect(email.remoteContentBanner).toBeHidden()
    await page.setViewportSize(viewport)

    // Nor when the email opens again
    await email.back()
    email = await mailbox.openEmail('first newsletter')
    await expect(email.body()).toContainText('first news')
    await expect(email.remoteContentBanner).toBeHidden()

    // Only this email: the next one of the sender asks
    await email.back()
    email = await mailbox.openEmail('second newsletter')
    await expect(email.remoteContentBanner).toBeVisible()
    await email.alwaysShowRemoteContentButton.click()
    await email.back()

    email = await mailbox.openEmail('third newsletter')
    await expect(email.body()).toContainText('third news')
    await expect(email.remoteContentBanner).toBeHidden()
    await expect.poll(() => requested).toContain('/third/pixel.png')
  })

  test('EML-29b the remote images of a sender of the domain of the user show without asking', async ({
    page,
    user,
    jmap
  }) => {
    await page.route(`${REMOTE_HOST}/**`, async route => {
      await route.fulfill({ contentType: 'image/png', body: PNG })
    })
    await jmap.sendEmail({
      to: user.email,
      subject: 'colleague newsletter',
      html: newsletter('colleague')
    })
    await jmap.waitForEmail({ subject: 'colleague newsletter' })

    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail('colleague newsletter')

    await expect(email.body()).toContainText('colleague news')
    await expect(email.remoteContentBanner).toBeHidden()
  })

  test('EML-28 opening an unread email marks it read', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'to be read', text: 'hi' })
    const sent = await jmap.waitForEmail({ subject: 'to be read' })

    const mailbox = await new LoginPage(page).loginAs(user)
    await expect(mailbox.emailRow('to be read')).toHaveAttribute(
      'data-unread',
      'true'
    )
    await expect(mailbox.folderUnreadCount({ role: 'inbox' })).toHaveText('1')

    const email = await mailbox.openEmail('to be read')
    await expect(mailbox.folderUnreadCount({ role: 'inbox' })).toBeHidden()
    await email.back()

    await expect(mailbox.emailRow('to be read')).not.toHaveAttribute(
      'data-unread'
    )
    await expect
      .poll(async () => (await jmap.getEmail(sent.id)).keywords)
      .toEqual(expect.objectContaining({ $seen: true }))
  })

  test(
    'EML-04 images keep within the reading pane, with their declared ratio',
    {
      tag: '@mobile'
    },
    async ({ page, user, jmap }) => {
      // tmail-flutter's 12 images, as data: images (remote ones wait for the user)
      const oversize = 'width="2000" height="200"'
      const normal = 'width="100" height="100"'
      const images: [string, string][] = [
        ['no-style', ''],
        [
          'oversize-style-full-whitespaces',
          'style="width: 2000px; height: 200px;"'
        ],
        ['oversize-style-whitespaces', 'style="width: 2000px;height: 200px;"'],
        ['oversize-style-no-whitespaces', 'style="width:2000px;height:200px;"'],
        ['oversize-attributes', oversize],
        [
          'oversize-style-and-attributes-1',
          `style="width: 2000px; height: 200px;" ${oversize}`
        ],
        [
          'oversize-style-and-attributes-2',
          `style="width: 2000px;height: 200px;" ${oversize}`
        ],
        [
          'oversize-style-and-attributes-3',
          `style="width:2000px;height:200px;" ${oversize}`
        ],
        ['normal-attributes', normal],
        [
          'normal-style-and-attributes-1',
          `style="width: 100px; height: 100px;" ${normal}`
        ],
        [
          'normal-style-and-attributes-2',
          `style="width: 100px;height: 100px;" ${normal}`
        ],
        [
          'normal-style-and-attributes-3',
          `style="width:100px;height:100px;" ${normal}`
        ]
      ]
      await jmap.sendEmail({
        to: user.email,
        subject: 'Deformed inlined image',
        html: images
          .map(([alt, size]) => `<img src="${PNG_DATA}" ${size} alt="${alt}">`)
          .join('<br>')
      })
      await jmap.waitForEmail({ subject: 'Deformed inlined image' })

      const mailbox = await new LoginPage(page).loginAs(user)
      const email = await mailbox.openEmail('Deformed inlined image')
      const body = email.body()
      await expect(body.locator('img')).toHaveCount(12)
      await expect
        .poll(() =>
          body
            .locator('img')
            .evaluateAll(all =>
              all.every(image => (image as HTMLImageElement).complete)
            )
        )
        .toBe(true)

      const content = await body
        .locator('#tmail-content')
        .evaluate(element => ({
          scroll: element.scrollWidth,
          client: element.clientWidth
        }))
      expect(content.scroll).toBeLessThanOrEqual(content.client)
      const rendered = await body.locator('img').evaluateAll(all =>
        all.map(image => {
          const box = image.getBoundingClientRect()
          return {
            alt: image.getAttribute('alt') ?? '',
            width: box.width,
            height: box.height
          }
        })
      )
      for (const { alt, width, height } of rendered) {
        if (alt.startsWith('oversize')) {
          expect(width, alt).toBeLessThanOrEqual(content.client)
          expect(width / height, alt).toBeCloseTo(10, 1)
        } else if (alt.startsWith('normal')) {
          expect([width, height], alt).toEqual([100, 100])
        } else {
          expect([width, height], alt).toEqual([1, 1])
        }
      }
      await expectNoA11yViolations(page)
    }
  )

  test(
    'EML-36 the quoted history of an answer is folded behind a button',
    {
      tag: '@mobile'
    },
    async ({ page, user, jmap }) => {
      await jmap.sendEmail({
        to: user.email,
        subject: 'Folded history',
        html: '<p>My answer</p><blockquote><p>The original message</p></blockquote>'
      })
      await jmap.waitForEmail({ subject: 'Folded history' })

      const mailbox = await new LoginPage(page).loginAs(user)
      const email = await mailbox.openEmail('Folded history')
      const body = email.body()
      const toggle = body.getByRole('group').locator('summary')
      const quote = body.getByText('The original message')
      await expect(body).toContainText('My answer')
      await expect(toggle).toHaveAccessibleName('Show trimmed content')
      await expect(quote).toBeHidden()
      await expectNoA11yViolations(page)

      const frame = page
        .getByTestId('email-view')
        .getByTestId('email-view-body')
      const folded = (await frame.boundingBox())?.height ?? 0
      // With the keyboard: Enter unfolds it, the frame grows; Space folds it again
      await toggle.focus()
      await page.keyboard.press('Enter')
      await expect(quote).toBeVisible()
      await expect(body.locator('details')).toHaveAttribute('open', '')
      await expect
        .poll(async () => (await frame.boundingBox())?.height ?? 0)
        .toBeGreaterThan(folded)
      await page.keyboard.press('Space')
      await expect(quote).toBeHidden()
    }
  )
})

test.describe('EML reading an email of a team mailbox', () => {
  test(
    'EML-35 the read receipt of an email of a team mailbox goes out from its identity',
    { tag: '@mobile' },
    async ({ page, user, users, jmap, jmapFor }) => {
      const bob = await users.create({ prefix: 'bob' })
      const team = await users.createTeamMailbox({ members: [user] })
      await jmapFor(bob).sendEmail({
        to: team.email,
        subject: 'Receipt from the team',
        text: 'Please confirm',
        headers: { 'Disposition-Notification-To': bob.email }
      })
      const teamInbox = await jmap.findMailboxByName('INBOX', {
        namespace: `TeamMailbox[${team.email}]`
      })
      await jmap.waitForEmail({
        subject: 'Receipt from the team',
        mailboxId: teamInbox.id,
        withoutSearch: true
      })

      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.toggleFolder({ name: team.name })
      await mailbox.openFolder({ id: teamInbox.id })
      await mailbox.emailRow('Receipt from the team').click()
      const dialog = mailbox.confirmDialog
      await expect(dialog).toContainText('Read receipt request')
      await expectNoA11yViolations(page)
      const sent = page.waitForRequest(
        request =>
          request.method() === 'POST' &&
          (request.postData() ?? '').includes('"MDN/send"')
      )
      await dialog.getByRole('button', { name: 'Yes' }).click()

      const body = (await sent).postDataJSON() as {
        methodCalls: [
          string,
          { identityId?: string; send?: { receipt?: { textBody?: string } } }
        ][]
      }
      const mdn = body.methodCalls.find(([name]) => name === 'MDN/send')?.[1]
      // James gives the members an identity of the team mailbox
      const teamIdentities = (await jmap.getIdentities())
        .filter(identity => identity.email === team.email)
        .map(identity => identity.id)
      expect(teamIdentities).not.toEqual([])
      expect(teamIdentities).toContain(mdn?.identityId)
      expect(mdn?.send?.receipt?.textBody).toContain(
        `Message was read by ${team.email}`
      )
      await expect(mailbox.toast).toContainText('A read receipt has been sent.')
    }
  )
})
