import { LabelModals, LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test, type E2EUser } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'

/** Emails "Email N subject <label>" sent to the user by another, tagged with the label */
async function tagEmails(
  jmap: JmapClient,
  sender: JmapClient,
  user: E2EUser,
  label: { keyword: string; displayName: string },
  count: number
): Promise<string[]> {
  const ids: string[] = []
  for (let index = 1; index <= count; index += 1) {
    const subject = `Email ${index} subject ${label.displayName}`
    // From another account: no copy in the Sent folder of the user
    await sender.sendEmail({ to: user.email, subject, text: 'Tagged' })
    const email = await jmap.waitForEmail({ subject, withoutSearch: true })
    await jmap.setKeywords(email.id, { [label.keyword]: true })
    ids.push(email.id)
  }
  return ids
}

test.describe('LBL labels', () => {
  // The reading view of a single email
  test.use({ emailsOneByOne: true })

  test(
    'LBL-01 a label created from the sidebar is listed there',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      const mailbox = await new LoginPage(page).loginAs(user)
      const labels = new LabelModals(page)
      if (await mailbox.folderMenuButton.isVisible())
        await mailbox.folderMenuButton.click()
      await labels.addButton.click()
      await expect(labels.labelModal).toContainText('Create a new label')
      await expectNoA11yViolations(page)
      await labels.fillAndSave('Projects', 'Work in progress')

      await expect(mailbox.toast).toContainText(
        'You successfully created the Projects label'
      )
      await expect(labels.item('Projects')).toBeVisible()
      await expect
        .poll(async () =>
          (await jmap.getLabels()).map(label => [
            label.displayName,
            label.description
          ])
        )
        .toEqual([['Projects', 'Work in progress']])
    }
  )

  test('LBL-02 a label is renamed from its menu', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.createLabel('Edit Tag 1')
    await jmap.createLabel('Edit Tag 2')
    await new LoginPage(page).loginAs(user)
    const labels = new LabelModals(page)

    await labels.runMenu('Edit Tag 1', 'edit')
    await expect(labels.nameInput).toHaveValue('Edit Tag 1')
    await labels.nameInput.fill('Edit Tag 2')
    await labels.saveButton.click()
    await expect(labels.labelModal).toContainText(
      'A tag with this name already exists'
    )
    await labels.fillAndSave('New edit tag 1')

    await expect(labels.item('New edit tag 1')).toBeVisible()
    await expect(labels.item('Edit Tag 1')).toHaveCount(0)
  })

  test('LBL-03 a label is deleted from its menu once confirmed', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.createLabel('Delete Tag 1')
    await jmap.createLabel('Delete Tag 2')
    const mailbox = await new LoginPage(page).loginAs(user)
    const labels = new LabelModals(page)

    await labels.runMenu('Delete Tag 1', 'delete')
    await expect(mailbox.confirmDialog).toContainText(
      'Are you sure you want to delete the label "Delete Tag 1"?'
    )
    await mailbox.confirmDialog
      .getByTestId('confirm-dialog-confirm-button')
      .click()

    await expect(labels.item('Delete Tag 1')).toHaveCount(0)
    await expect(labels.item('Delete Tag 2')).toBeVisible()
  })

  test('LBL-04 a label lists its emails', async ({
    page,
    user,
    jmap,
    users,
    jmapFor
  }) => {
    const sender = jmapFor(await users.create())
    const tags = [
      await jmap.createLabel('Tag 1'),
      await jmap.createLabel('Tag 2')
    ]
    for (const tag of tags) await tagEmails(jmap, sender, user, tag, 3)
    const mailbox = await new LoginPage(page).loginAs(user)
    const labels = new LabelModals(page)

    for (const tag of tags) {
      await labels.open(tag.displayName)
      await expect(
        mailbox.emailList.getByTestId('email-list-item-subject')
      ).toHaveText(
        [3, 2, 1].map(index => `Email ${index} subject ${tag.displayName}`)
      )
      await expect(
        mailbox.emailList.getByTestId('label-chip').first()
      ).toHaveText(tag.displayName)
    }
    await expectNoA11yViolations(page)
  })

  test('LBL-05 a label without email shows the empty view', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.createLabel('Tag without email')
    await new LoginPage(page).loginAs(user)
    const labels = new LabelModals(page)

    await labels.open('Tag without email')
    await expect(page.getByTestId('empty-thread-view')).toContainText(
      "You don't have any emails tagged with this."
    )
  })

  test('LBL-06 the emails of a label say their folder', async ({
    page,
    user,
    jmap,
    users,
    jmapFor
  }) => {
    const sender = jmapFor(await users.create())
    const tag = await jmap.createLabel('Tag 1')
    const ids = await tagEmails(jmap, sender, user, tag, 2)
    const trash = await jmap.findMailboxByRole('trash')
    for (const id of ids) {
      await jmap.call('Email/set', {
        update: { [id]: { mailboxIds: { [trash.id]: true } } }
      })
    }
    const mailbox = await new LoginPage(page).loginAs(user)
    await new LabelModals(page).open('Tag 1')

    await expect(mailbox.emailRow('Email 1 subject Tag 1')).toContainText(
      'Trash'
    )
    await expect(mailbox.emailRow('Email 2 subject Tag 1')).toContainText(
      'Trash'
    )
  })

  test('LBL-07 "Label as" on an email creates a label and puts it on', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({
      to: user.email,
      subject: 'Needs a label',
      text: 'Hi'
    })
    await jmap.waitForEmail({ subject: 'Needs a label' })
    const mailbox = await new LoginPage(page).loginAs(user)
    const labels = new LabelModals(page)
    const email = await mailbox.openEmail('Needs a label')

    await email.runAction('label-as')
    await labels.chooseCreateButton.click()
    await labels.fillAndSave('Created from email')
    await expect(labels.chooseCheckbox('Created from email')).toBeChecked()
    await labels.chooseApplyButton.click()

    await expect(mailbox.toast).toContainText(
      'Label "Created from email" added to email'
    )
    await expect(email.root.getByTestId('label-chip')).toContainText(
      'Created from email'
    )
  })

  test('LBL-08 "Label as" without labels invites to create one', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({
      to: user.email,
      subject: 'No label yet',
      text: 'Hi'
    })
    await jmap.waitForEmail({ subject: 'No label yet' })
    const mailbox = await new LoginPage(page).loginAs(user)
    const labels = new LabelModals(page)

    await mailbox.selectEmail('No label yet')
    await mailbox.runSelectionAction('label-as')

    await expect(labels.chooseEmpty).toContainText('No Labels yet')
    await expect(labels.chooseCreateButton).toHaveText('Create a label')
    await expect(
      labels.chooseModal.getByTestId('choose-label-list')
    ).toHaveCount(0)
    await expectNoA11yViolations(page)
  })

  test('LBL-09 a label created from the empty "Label as" is listed there', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'First label', text: 'Hi' })
    await jmap.waitForEmail({ subject: 'First label' })
    const mailbox = await new LoginPage(page).loginAs(user)
    const labels = new LabelModals(page)

    await mailbox.selectEmail('First label')
    await mailbox.runSelectionAction('label-as')
    await labels.chooseCreateButton.click()
    await labels.fillAndSave('From empty state')

    await expect(mailbox.toast).toContainText(
      'You successfully created the From empty state label'
    )
    await expect(labels.chooseEmpty).toHaveCount(0)
    await expect(labels.chooseCheckbox('From empty state')).toBeVisible()
  })

  test('LBL-10 "Label as" lists the existing labels, then the one created', async ({
    page,
    user,
    jmap,
    users,
    jmapFor
  }) => {
    const sender = jmapFor(await users.create())
    const existing = await jmap.createLabel('Existing Label 1')
    const [id] = await tagEmails(jmap, sender, user, existing, 1)
    void id
    const mailbox = await new LoginPage(page).loginAs(user)
    const labels = new LabelModals(page)

    await mailbox.selectEmail(`Email 1 subject ${existing.displayName}`)
    await mailbox.runSelectionAction('label-as')
    await expect(labels.chooseCheckbox('Existing Label 1')).toBeChecked()
    await labels.chooseCreateButton.click()
    await labels.fillAndSave('Another label')

    await expect(mailbox.toast).toContainText(
      'You successfully created the Another label label'
    )
    await expect(labels.chooseCheckbox('Another label')).toBeChecked()
    await expect(labels.chooseCheckbox('Existing Label 1')).toBeChecked()
  })

  test('LBL-11 the × of a label chip takes the label off the email', async ({
    page,
    user,
    jmap,
    users,
    jmapFor
  }) => {
    const sender = jmapFor(await users.create())
    const tag = await jmap.createLabel('Remove Tag 1')
    const [emailId = ''] = await tagEmails(jmap, sender, user, tag, 1)
    const mailbox = await new LoginPage(page).loginAs(user)
    await new LabelModals(page).open('Remove Tag 1')
    const email = await mailbox.openEmail('Email 1 subject Remove Tag 1')

    const chip = email.root.getByTestId('label-chip')
    await expect(chip).toHaveText(/Remove Tag 1/)
    await chip
      .getByRole('button', { name: 'Remove the label Remove Tag 1' })
      .click()

    await expect(mailbox.toast).toContainText(
      'Label "Remove Tag 1" removed from email'
    )
    await expect(chip).toHaveCount(0)
    await expect
      .poll(async () => (await jmap.getEmail(emailId)).keywords)
      .not.toHaveProperty(tag.keyword)
  })
})
