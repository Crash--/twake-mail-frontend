import { EmailPage, LoginPage } from '../pages'
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

  test('EML-29c the browser back button leaves an email whose remote images were shown', async ({
    page,
    user,
    jmap
  }) => {
    await page.route(`${REMOTE_HOST}/**`, async route => {
      await route.fulfill({ contentType: 'image/png', body: PNG })
    })
    await jmap.importEmlContent(newsletterEml('back', user.email))

    const mailbox = await new LoginPage(page).loginAs(user)
    const listUrl = page.url()
    const email = await mailbox.openEmail('back newsletter')
    await expect(email.body()).toContainText('back news')
    await email.showRemoteContentButton.click()
    await expect(email.remoteContentBanner).toBeHidden()

    await page.goBack()

    await expect(page).toHaveURL(listUrl)
    await expect(mailbox.emailRow('back newsletter')).toBeVisible()
  })

  test('EML-29d with "Show remote images" on, every email shows them without asking, until turned off', async ({
    page,
    user,
    jmap
  }) => {
    const requested: string[] = []
    await page.route(`${REMOTE_HOST}/**`, async route => {
      requested.push(new URL(route.request().url()).pathname)
      await route.fulfill({ contentType: 'image/png', body: PNG })
    })
    await jmap.importEmlContent(newsletterEml('always', user.email))
    await jmap.importEmlContent(newsletterEml('asked', user.email))

    const mailbox = await new LoginPage(page).loginAs(user)
    let settings = await mailbox.openSettings()
    await settings.open('preferences')
    const toggle = page.getByRole('switch', { name: 'Show remote images' })
    // Off by default: the reader asks
    await expect(toggle).not.toBeChecked()
    await toggle.click()
    await expect(toggle).toBeChecked()
    // Warned, in one line under the switch
    await expect(
      page.getByText(
        'Always showing remote images exposes you to activity tracking and thus could harm your privacy.'
      )
    ).toBeVisible()
    await expectNoA11yViolations(page)
    await settings.backToMail()

    let email = await mailbox.openEmail('always newsletter')
    await expect(email.body()).toContainText('always news')
    await expect(email.remoteContentBanner).toBeHidden()
    await expect
      .poll(() => [...requested].sort())
      .toEqual(['/always/background.png', '/always/pixel.png'])
    await email.back()

    settings = await mailbox.openSettings()
    await settings.open('preferences')
    await toggle.click()
    await expect(toggle).not.toBeChecked()
    await settings.backToMail()

    email = await mailbox.openEmail('asked newsletter')
    await expect(email.body()).toContainText('asked news')
    await expect(email.remoteContentBanner).toBeVisible()
    expect(requested.filter(path => path.startsWith('/asked/'))).toEqual([])
  })

  test('EML-29e an Outlook email declaring its fonts without a source shows no remote images banner', async ({
    page,
    user,
    jmap
  }) => {
    const style = [
      '@font-face {font-family:"Cambria Math"; panose-1:2 4 5 3 5 4 6 3 2 4;}',
      '@font-face {font-family:Calibri; panose-1:2 15 5 2 2 2 4 3 2 4;}',
      '@font-face {font-family:Aptos; src:local("Aptos");}',
      'p.MsoNormal {margin:0cm; font-size:11.0pt; font-family:"Calibri",sans-serif;}',
      'v\\:* {behavior:url(#default#VML);}'
    ].join('\r\n')
    await jmap.importEmlContent(
      Buffer.from(
        [
          'From: Administrator <postmaster@outlook.example.org>',
          `To: ${user.email}`,
          'Subject: Outlook greeting card',
          `Message-ID: <outlook-${Date.now()}@outlook.example.org>`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=utf-8',
          '',
          `<html><head><style>${style}</style></head><body><p class="MsoNormal">Season's greetings</p></body></html>`
        ].join('\r\n'),
        'utf8'
      )
    )

    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail('Outlook greeting card')

    await expect(email.body()).toContainText("Season's greetings")
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
    'EML-39 a body that fits in its frame does not scroll in it',
    async ({ page, user, jmap }) => {
      // Paragraphs as Twake Mail writes them: their lines add up to a fraction
      // of a pixel over the rounded height of the frame
      const paragraph = (text: string): string =>
        `<p align="left" style="line-height: 100%; margin-bottom: 0in">${text}</p>`
      const lines = [
        'Dear Alice,&nbsp;',
        '<br>',
        'Could you please approve the payment below?',
        '<b>Amount:&nbsp; 1,000 EUR&nbsp;</b>',
        '<i>(100 EUR * 10 items)&nbsp;</i>',
        '<br>',
        '<i><u>Transfer information</u></i>:&nbsp;',
        ...Array.from({ length: 8 }, (_, index) => `Detail ${index + 1}`),
        '<br>',
        'Thanks &amp; best regards,',
        '<br>',
        'Bob'
      ]
      await jmap.sendEmail({
        to: user.email,
        subject: 'Fitting body',
        html: lines.map(paragraph).join('')
      })
      await jmap.waitForEmail({ subject: 'Fitting body' })
      // The body may show while the email slides in: a pointer over it hits
      // the view transition, not the frame, until the transition ends
      await page.emulateMedia({ reducedMotion: 'reduce' })

      const mailbox = await new LoginPage(page).loginAs(user)
      const email = await mailbox.openEmail('Fitting body')
      const body = email.body()
      await expect(body.getByText('Bob', { exact: true })).toBeVisible()

      // The wheel over the body scrolls the reading pane, never the body
      await body.getByText('Detail 4').hover()
      await page.mouse.wheel(0, 100)
      await expect
        .poll(() =>
          body.locator('#tmail-content').evaluate(element => element.scrollTop)
        )
        .toBe(0)
      expect(
        await body.evaluate(element => ({
          html: element.ownerDocument.documentElement.scrollTop,
          body: element.scrollTop
        }))
      ).toEqual({ html: 0, body: 0 })
    }
  )

  test('EML-40 a link to an anchor of the email scrolls the reading pane to it, in the same tab', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({
      to: user.email,
      subject: 'Table of contents',
      html: [
        '<p><a href="#closing">Go to the closing words</a></p>',
        ...Array.from({ length: 80 }, (_, index) => `<p>Line ${index + 1}</p>`),
        '<h2 id="closing">Closing words</h2>'
      ].join('')
    })
    await jmap.waitForEmail({ subject: 'Table of contents' })
    // No view transition over the body to click through
    await page.emulateMedia({ reducedMotion: 'reduce' })

    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail('Table of contents')
    const closing = email.body().getByRole('heading', { name: 'Closing words' })
    await expect(closing).not.toBeInViewport()

    await email.bodyLink('Go to the closing words').click()

    await expect(closing).toBeInViewport()
    expect(page.context().pages()).toHaveLength(1)
  })

  test(
    'EML-41 a wide newsletter fits in the reading pane without sideways scrolling, at every width',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      const cells = (count: number, width: number): string =>
        Array.from(
          { length: count },
          (_, index) =>
            `<td width="${String(width)}" style="padding: 8px">Column ${String(index + 1)} of the weekly digest, with a few words to wrap</td>`
        ).join('')
      await jmap.sendEmail({
        to: user.email,
        subject: 'Wide newsletter',
        html: [
          '<p>My answer above the digest</p>',
          '<blockquote>',
          '<div style="width: 1200px" id="wide-block">An image-less block of 1200 pixels that reflows to the width of the pane, its text keeping its size</div>',
          `<table width="900" id="fixed-table"><tr>${cells(3, 300)}</tr><tr><td colspan="3"><img src="${PNG_DATA}" width="900" height="90" alt="Banner"></td></tr></table>`,
          // Cells that cannot be narrower than 1400 pixels together: scaled down
          // Padding over a fixed width; a table whose cells keep it wide
          '<div id="padded-block" style="width: 1200px; background: #ffeedd; padding: 8px">A padded block of 1200 pixels</div>',
          `<table id="min-width-table" style="min-width: 1400px"><tr>${Array.from({ length: 4 }, (_, index) => `<td style="min-width: 350px">Cell ${String(index + 1)}</td>`).join('')}</tr></table>`,
          '<table id="unshrinkable"><tr><td style="min-width: 700px">Left column</td><td style="min-width: 700px"><a href="mailto:digest@example.com">Write to the digest</a></td></tr></table>',
          `<p style="white-space: nowrap" id="nowrap">${'A line that its sender forbids to wrap, longer than the reading pane. '.repeat(4)}</p>`,
          `<table width="1000" id="quoted-table"><tr>${cells(2, 500)}</tr></table>`,
          '<p>Unsubscribe from the digest</p>',
          '</blockquote>'
        ].join('')
      })
      await jmap.waitForEmail({ subject: 'Wide newsletter' })
      // No view transition over the body to click through
      await page.emulateMedia({ reducedMotion: 'reduce' })

      const mailbox = await new LoginPage(page).loginAs(user)
      const email = await mailbox.openEmail('Wide newsletter')
      const body = email.body()
      const frame = email.root.getByTestId('email-view-body')
      const content = body.locator('#tmail-content')
      await expect(body.getByText('Unsubscribe from the digest')).toBeAttached()

      /** No sideways scrolling, and a frame as high as its content */
      const expectFitted = async (): Promise<void> => {
        await expect
          .poll(() =>
            content.evaluate(element => element.scrollWidth - element.clientWidth)
          )
          .toBeLessThanOrEqual(0)
        await expect
          .poll(async () => {
            const frameHeight = (await frame.boundingBox())?.height ?? 0
            const contentHeight = await content.evaluate(
              element => element.getBoundingClientRect().height
            )
            // The frame rounds up, and keeps its height for a pixel of change
            return frameHeight >= contentHeight && frameHeight < contentHeight + 2
          })
          .toBe(true)
        // Nothing cut at the bottom of the frame
        const { scrollHeight, clientHeight } = await body.evaluate(element => ({
          scrollHeight: element.ownerDocument.documentElement.scrollHeight,
          clientHeight: element.ownerDocument.documentElement.clientHeight
        }))
        expect(scrollHeight).toBeLessThanOrEqual(clientHeight + 1)
      }

      // The wide parts are in the quoted history, folded: opening it fits them
      const toggle = body.getByRole('group').locator('summary')
      await toggle.click()
      await expect(body.getByText('Unsubscribe from the digest')).toBeVisible()
      await expectFitted()

      const widths = await content.evaluate(element => {
        const width = (selector: string): number =>
          element.querySelector(selector)?.getBoundingClientRect().width ?? 0
        return {
          content: element.clientWidth,
          block: width('#wide-block'),
          table: width('#fixed-table'),
          quoted: width('#quoted-table'),
          padded: width('#padded-block'),
          minWidth: width('#min-width-table'),
          unshrinkable: width('#unshrinkable')
        }
      })
      expect(widths.block).toBeLessThanOrEqual(widths.content)
      expect(widths.table).toBeLessThanOrEqual(widths.content)
      expect(widths.quoted).toBeLessThanOrEqual(widths.content)
      expect(widths.padded).toBeLessThanOrEqual(widths.content)
      expect(widths.minWidth).toBeLessThanOrEqual(widths.content)
      expect(widths.unshrinkable).toBeLessThanOrEqual(widths.content)
      // Reflowed, not scaled: the text keeps its size
      for (const id of ['#wide-block', '#fixed-table']) {
        await expect(body.locator(id)).not.toHaveClass(/tmail-fit-scaled/)
      }
      const fontSize = await body
        .locator('#wide-block')
        .evaluate(element => getComputedStyle(element).fontSize)
      expect(fontSize).toBe(
        await body.evaluate(element => getComputedStyle(element).fontSize)
      )
      await expect(body.locator('#nowrap')).toHaveCSS('white-space', 'normal')
      await expect(body.locator('#unshrinkable')).toHaveClass(/tmail-fit-scaled/)
      await expect(body.locator('#min-width-table')).toHaveClass(
        /tmail-fit-scaled/
      )
      // The padding stays inside the width: reflowed, not scaled
      await expect(body.locator('#padded-block')).not.toHaveClass(
        /tmail-fit-scaled/
      )

      // A narrower window fits it again (within the same layout of the app,
      // which would open the email anew)
      const viewport = page.viewportSize() ?? { width: 1280, height: 720 }
      await page.setViewportSize({
        width: viewport.width - 40,
        height: viewport.height
      })
      await expect
        .poll(() => content.evaluate(element => element.clientWidth))
        .toBeLessThan(widths.content)
      await expectFitted()

      // The links of a scaled part still answer the pointer
      const composer = await email.openComposerFromBodyLink(
        'Write to the digest'
      )
      await expect(
        composer.recipients('to').filter({ hasText: 'digest@example.com' })
      ).toBeVisible()
      await expectNoA11yViolations(page)
    }
  )

  test('EML-42 a body the server cannot give is never shown as an empty message', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({
      to: user.email,
      subject: 'Fragile body',
      html: '<p>The real content</p>'
    })
    await jmap.waitForEmail({ subject: 'Fragile body' })
    type Invocation = [string, Record<string, unknown>, string]
    /**
     * Changes the answer to the `Email/get` of the reading view (the one
     * asking for the body values) as tmail-backend sends it when it fails
     */
    const breakBody = async (
      change: (invocation: Invocation) => Invocation
    ): Promise<void> => {
      await page.route('**/jmap', async route => {
        if (!(route.request().postData() ?? '').includes('fetchHTMLBodyValues')) {
          await route.continue()
          return
        }
        const response = await route.fetch()
        const json = (await response.json()) as {
          methodResponses: Invocation[]
        }
        json.methodResponses = json.methodResponses.map(invocation =>
          invocation[0] === 'Email/get' ? change(invocation) : invocation
        )
        await route.fulfill({ response, json })
      })
    }
    const withBodyValues = (
      [name, args, callId]: Invocation,
      bodyValues: (values: Record<string, unknown>) => Record<string, unknown>
    ): Invocation => {
      const list = (args.list as Record<string, unknown>[]).map(email => ({
        ...email,
        bodyValues: bodyValues(email.bodyValues as Record<string, unknown>)
      }))
      return [name, { ...args, list }, callId]
    }

    // A `serverFail` on Email/get (tmail-flutter tf#3487: S3 broken)
    await breakBody(([, , callId]) => ['error', { type: 'serverFail' }, callId])
    const mailbox = await new LoginPage(page).loginAs(user)
    // The error screen has no subject to wait for
    await mailbox.emailRow('Fragile body').click()
    const error = page.getByTestId('email-view-error')
    await expect(error).toBeVisible()
    await expect(page.getByTestId('email-view-body')).toHaveCount(0)
    // Like any view (#656): the page is named, the error is the h1 of the
    // main landmark, Retry has the focus, the way back to the list stays
    const errorTitle = 'Error! An error occurred. Please try again later.'
    await expect(
      page.getByRole('main').getByRole('heading', { level: 1, name: errorTitle })
    ).toBeVisible()
    await expect(page).toHaveTitle(/Error - Twake Mail$/)
    await expect(error.getByRole('button', { name: 'Retry' })).toBeFocused()
    await expect(page.getByTestId('email-view-back-button')).toBeVisible()
    await expectNoA11yViolations(page)

    // The body parts without their values: the headers stay, an alert says it
    await page.unrouteAll({ behavior: 'wait' })
    await breakBody(invocation => withBodyValues(invocation, () => ({})))
    await error.getByRole('button', { name: 'Retry' }).click()
    const alert = page.getByTestId('email-body-error')
    await expect(alert).toHaveText(
      /The content of this message could not be loaded\./
    )
    await expect(page.getByTestId('email-view-subject')).toHaveText(
      'Fragile body'
    )
    await expect(page.getByTestId('email-view-body')).toHaveCount(0)
    await expectNoA11yViolations(page)

    // A cut body: what there is, a notice, the whole message in its EML
    await page.unrouteAll({ behavior: 'wait' })
    await breakBody(invocation =>
      withBodyValues(invocation, values =>
        Object.fromEntries(
          Object.entries(values).map(([partId, value]) => [
            partId,
            { ...(value as object), isTruncated: true }
          ])
        )
      )
    )
    await page.getByTestId('email-body-retry-button').click()
    const email = new EmailPage(page)
    await expect(email.body()).toContainText('The real content')
    await expect(page.getByTestId('email-body-error')).toHaveCount(0)
    const notice = page.getByTestId('email-body-truncated')
    await expect(notice).toHaveText(
      /This message is too long to be shown in full\./
    )
    const downloading = page.waitForEvent('download')
    await page.getByTestId('email-body-download-eml-button').click()
    expect((await downloading).suggestedFilename()).toBe('Fragile body.eml')
    await expectNoA11yViolations(page)
  })

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
