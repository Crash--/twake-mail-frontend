import type { Page } from '@playwright/test'

import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'

function textFile(name: string): {
  name: string
  mimeType: string
  buffer: Buffer
} {
  return { name, mimeType: 'text/plain', buffer: Buffer.from(name) }
}

/** Holds the uploads of the page until `release()` */
async function holdUploads(page: Page): Promise<() => void> {
  let release = (): void => undefined
  const gate = new Promise<void>(resolve => {
    release = resolve
  })
  await page.route('**/upload/**', async route => {
    await gate
    await route.continue()
  })
  return release
}

async function setSignature(jmap: JmapClient, html: string): Promise<void> {
  const accountId = await jmap.accountId()
  const [identities] = await jmap.request([
    ['Identity/get', { accountId, ids: null }, 'i']
  ])
  const id = (identities?.[1].list as { id: string }[])[0]?.id ?? ''
  await jmap.request([
    [
      'Identity/set',
      { accountId, update: { [id]: { htmlSignature: html } } },
      's'
    ]
  ])
}

test.describe('CMP: attachments, signature and recipient chips of the composer', () => {
  test('CMP-71 the files are chips with their state; a long list folds and unfolds', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    for (const name of ['a.pdf', 'b.doc', 'c.zip', 'd.txt']) {
      await composer.attachFile(textFile(name))
    }
    await expect(composer.attachments).toHaveCount(4)
    await expect(composer.attachments.first()).toContainText('Uploaded')
    await expectNoA11yViolations(page)

    const toggle = composer.root.getByTestId('composer-attachments-toggle')
    await expect(toggle).toHaveText('Show less')
    await toggle.click()
    await expect(composer.attachments).toHaveCount(2)
    await expect(toggle).toHaveText('Show more (+2)')
    await expectNoA11yViolations(page)
    await toggle.click()
    await expect(composer.attachments).toHaveCount(4)
  })

  test('CMP-72 more than 9 files uploading at once are listed in a popup on a desktop', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    const release = await holdUploads(page)
    const names = Array.from(
      { length: 10 },
      (_, index) => `f${String(index)}.txt`
    )
    await composer.root
      .getByTestId('composer-file-input')
      .setInputFiles(names.map(textFile))

    const popup = page.getByRole('region', { name: 'Uploading 10 files' })
    await expect(popup).toBeVisible()
    await expect(popup.getByRole('progressbar')).toHaveCount(10)
    await expect(composer.attachments).toHaveCount(0)
    await expectNoA11yViolations(page)

    release()
    await expect(popup).toBeHidden({ timeout: 20_000 })
    await expect(composer.attachments).toHaveCount(10)
  })

  test('CMP-73 a failed upload says so and is sent again with its Retry button', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    let failures = 1
    await page.route('**/upload/**', async route => {
      if (failures > 0) {
        failures -= 1
        await route.fulfill({ status: 500, body: 'no' })
        return
      }
      await route.continue()
    })
    await composer.root
      .getByTestId('composer-file-input')
      .setInputFiles(textFile('retry.txt'))

    await expect(composer.attachments).toHaveAttribute('data-status', 'failed')
    await expect(composer.attachments).toContainText('Upload failed')
    await expectNoA11yViolations(page)
    await composer.root.getByRole('button', { name: 'Retry retry.txt' }).click()
    await expect(composer.attachments).toHaveAttribute('data-status', 'done', {
      timeout: 20_000
    })
  })

  test('CMP-74 the signature is a card under a "Signature" pill that folds it', async ({
    page,
    user,
    jmap
  }) => {
    await setSignature(jmap, '<p>CARD_SIGNATURE <b>Alice</b></p>')
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()

    const pill = composer.root.getByTestId('composer-signature-toggle')
    await expect(pill).toHaveAttribute('aria-expanded', 'true')
    await expect(composer.root.getByText('CARD_SIGNATURE')).toBeVisible()
    await expectNoA11yViolations(page)
    await pill.click()
    await expect(pill).toHaveAttribute('aria-expanded', 'false')
    await expect(composer.root.getByText('CARD_SIGNATURE')).toBeHidden()
    // Folded in the view only: the message still carries it
    expect(await composer.editorHtml()).toContain('CARD_SIGNATURE')
  })

  test('CMP-75 the folded recipients are chips with a "+N" counter; a click unfolds them into To', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    const emails = Array.from(
      { length: 8 },
      (_, index) => `person.with.a.long.name.${String(index)}@example.com`
    )
    await composer.fill({ to: emails, subject: 'Chips' })
    await composer.subjectInput.click()

    await expect(composer.recipientsSummary).toBeVisible()
    await expect(composer.recipientsSummary).toContainText(/\+\d/)
    await expect(composer.recipientsSummary).toHaveAccessibleName(
      new RegExp(`Show all the recipients: ${emails[0] ?? ''}`)
    )
    await expectNoA11yViolations(page)

    await composer.recipientsSummary.click()
    await expect(composer.recipientInput('to')).toBeFocused()
    await expect(composer.recipients('to')).toHaveCount(8)
    // The chips are out of the tab order, the keyboard moves between them
    await page.keyboard.press('ArrowLeft')
    await expect(composer.recipients('to').last()).toBeFocused()
    await expectNoA11yViolations(page)
  })

  test('CMP-76 on a phone, more than 9 uploads stay chips in the list, no popup', async ({
    page,
    user
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    const release = await holdUploads(page)
    const names = Array.from(
      { length: 10 },
      (_, index) => `p${String(index)}.txt`
    )
    await composer.root
      .getByTestId('composer-file-input')
      .setInputFiles(names.map(textFile))

    await expect(composer.attachments).toHaveCount(10)
    await expect(page.getByRole('region', { name: /Uploading/ })).toHaveCount(0)
    release()
    await expect(composer.attachments.last()).toHaveAttribute(
      'data-status',
      'done',
      { timeout: 20_000 }
    )
  })

  test('CMP-77 files dragged over the composer show the drop panel; dropping them attaches them', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    const zone = composer.root.getByTestId('composer-drop-zone')
    const dataTransfer = await page.evaluateHandle(() => {
      const transfer = new DataTransfer()
      transfer.items.add(new File(['dropped'], 'dropped.txt', { type: 'text/plain' }))
      return transfer
    })

    await zone.dispatchEvent('dragenter', { dataTransfer })
    await expect(zone.getByText('Drop file here to attach them')).toBeVisible()
    await zone.dispatchEvent('drop', { dataTransfer })
    await expect(zone.getByText('Drop file here to attach them')).toBeHidden()
    await expect(composer.attachments).toHaveCount(1)
    await expect(composer.attachments).toContainText('dropped.txt')
  })
})
