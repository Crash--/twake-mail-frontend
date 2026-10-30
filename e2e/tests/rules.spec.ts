import { LoginPage, SettingsPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

const FILTER = 'com:linagora:params:jmap:filter'

test.describe('RULE email rules', () => {
  test('RULE-20 the fields of a condition share a row, Enter saves the rule', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const settings = await mailbox.openSettings()
    await settings.open('email-rules')
    await settings.addRuleButton.click()
    const dialog = settings.ruleDialog
    const condition = dialog.getByTestId('rule-condition')
    const field = await condition
      .getByTestId('rule-condition-field-select')
      .boundingBox()
    const comparator = await condition
      .getByTestId('rule-condition-comparator-select')
      .boundingBox()
    const value = await condition
      .getByTestId('rule-condition-value-input')
      .boundingBox()
    expect(comparator?.x).toBeGreaterThan((field?.x ?? 0) + (field?.width ?? 0))
    expect(value?.y).toBeGreaterThan(
      (field?.y ?? 0) + (field?.height ?? 0)
    )

    await condition.getByTestId('rule-condition-value-input').fill('by enter')
    await settings.selectRuleAction(1, 'Mark as seen')
    await dialog.getByTestId('rule-name-input').fill('By enter')
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    await expect(settings.rule('By enter')).toBeVisible()
  })

  // The reading view of a single email: its sender is a button
  test.use({ emailsOneByOne: true })

  test('RULE-01 a rejecting rule created from the sender address warns, and again once edited', async ({
    page,
    user,
    jmap
  }) => {
    const subject = 'Rule with reject'
    await jmap.sendEmail({ to: user.email, subject, text: 'Reject me' })
    await jmap.waitForEmail({ subject })

    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail(subject)
    await email.from.getByTestId('email-address').click()
    await expect(page.getByTestId('email-address-card')).toBeVisible()
    await expectNoA11yViolations(page)
    await page.getByTestId('email-address-create-rule-item').click()

    const settings = new SettingsPage(page)
    const dialog = settings.ruleDialog
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('rule-condition-value-input')).toHaveValue(
      user.email
    )
    await dialog.getByTestId('rule-name-input').fill('Reject rule')
    await settings.selectRuleAction(1, 'Reject it')
    await expectNoA11yViolations(page)
    await dialog.getByTestId('create-rule-button').click()
    await expect(settings.confirmDialog).toContainText(
      'This action is irreversible. Are you sure you want to proceed?'
    )
    await settings.confirmDialog
      .getByTestId('confirm-dialog-confirm-button')
      .click()
    await expect(dialog).toBeHidden()
    await expect(settings.toast).toContainText('New filter was created')
    await expect(settings.rule('Reject rule')).toBeVisible()
    await expect(settings.rule('Reject rule')).toContainText(
      `From, contains: ${user.email}`
    )

    // Edited: another condition, and the warning again
    await settings
      .rule('Reject rule')
      .getByTestId('email-rule-edit-button')
      .click()
    await expect(dialog).toBeVisible()
    await dialog.getByTestId('rule-add-condition-button').click()
    const second = dialog.getByRole('group', { name: 'Condition 2' })
    await second
      .getByTestId('rule-condition-field-select')
      .selectOption({ label: 'Subject' })
    await second.getByTestId('rule-condition-value-input').fill('reject')
    await dialog.getByTestId('create-rule-button').click()
    await expect(settings.confirmDialog).toContainText(
      'Are you sure you want to proceed?'
    )
    await settings.confirmDialog
      .getByTestId('confirm-dialog-confirm-button')
      .click()
    await expect(dialog).toBeHidden()
    await expect(settings.rule('Reject rule')).toBeVisible()

    await expect
      .poll(async () => {
        const result = await jmap.call('Filter/get', { ids: ['singleton'] }, [
          FILTER
        ])
        return (result.list as { rules: unknown[] }[])[0]?.rules
      })
      .toEqual([
        expect.objectContaining({
          name: 'Reject rule',
          conditionGroup: {
            conditionCombiner: 'AND',
            conditions: [
              { field: 'from', comparator: 'contains', value: user.email },
              { field: 'subject', comparator: 'contains', value: 'reject' }
            ]
          },
          action: expect.objectContaining({ reject: true, markAsSeen: false })
        })
      ])
  })

  test('RULE-02 a rule moves the new emails it matches into a folder, until deleted', async ({
    page,
    user,
    jmap
  }) => {
    const folder = await jmap.createMailbox({ name: 'Newsletters' })
    const mailbox = await new LoginPage(page).loginAs(user)
    const settings = await mailbox.openSettings()
    await settings.open('email-rules')
    await expect(page.getByTestId('email-rules-empty')).toContainText(
      'No Rules Configured'
    )

    await settings.addRuleButton.click()
    const dialog = settings.ruleDialog
    await dialog.getByTestId('rule-name-input').fill('Newsletters')
    const condition = dialog.getByRole('group', { name: 'Condition 1' })
    await condition
      .getByTestId('rule-condition-field-select')
      .selectOption({ label: 'Subject' })
    await condition.getByTestId('rule-condition-value-input').fill('[weekly]')
    await settings.selectRuleAction(1, 'Move message')
    await dialog.getByTestId('rule-action-folder-button').click()
    const picker = page.getByRole('dialog', { name: 'Choose a folder' })
    await picker.getByRole('option', { name: /Newsletters/ }).click()
    await expect(dialog.getByTestId('rule-action-folder-button')).toContainText(
      'Newsletters'
    )
    await dialog.getByTestId('rule-add-action-button').click()
    await settings.selectRuleAction(2, 'Mark as seen')
    await dialog.getByTestId('create-rule-button').click()
    await expect(dialog).toBeHidden()
    await expect(settings.rule('Newsletters')).toContainText(
      'Subject, contains: [weekly]'
    )

    await jmap.sendEmail({
      to: user.email,
      subject: '[weekly] issue 1',
      text: 'News'
    })
    const filed = await jmap.waitForEmail({
      subject: '[weekly] issue 1',
      mailboxId: folder.id
    })
    expect(filed.keywords).toMatchObject({ $seen: true })

    await settings
      .rule('Newsletters')
      .getByTestId('email-rule-delete-button')
      .click()
    await settings.confirmDialog
      .getByTestId('confirm-dialog-confirm-button')
      .click()
    await expect(settings.toast).toContainText('The rule has been removed.')
    await expect(page.getByTestId('email-rules-empty')).toBeVisible()
  })

  test('RULE-03 a rule moving to a folder deleted since cannot be saved until another folder is chosen', async ({
    page,
    user,
    jmap
  }) => {
    // tmail-backend drops the folder from the rules when it is deleted
    // (tmail-backend#2307): the rule is saved after, as a client that did
    // not know yet would
    const gone = await jmap.createMailbox({ name: 'Gone' })
    await jmap.destroyMailbox(gone.id)
    const kept = await jmap.createMailbox({ name: 'Kept' })
    await jmap.call(
      'Filter/set',
      {
        update: {
          singleton: [
            {
              id: '0',
              name: 'Dangling',
              conditionGroup: {
                conditionCombiner: 'AND',
                conditions: [
                  { field: 'subject', comparator: 'contains', value: '[gone]' }
                ]
              },
              action: {
                appendIn: { mailboxIds: [gone.id] },
                markAsSeen: true,
                markAsImportant: false,
                reject: false,
                withKeywords: []
              }
            }
          ]
        }
      },
      [FILTER]
    )

    const mailbox = await new LoginPage(page).loginAs(user)
    const settings = await mailbox.openSettings()
    await settings.open('email-rules')
    await expect(settings.rule('Dangling')).toContainText(
      'Subject, contains: [gone]'
    )
    await expect(settings.rule('Dangling')).not.toContainText('""')

    await settings
      .rule('Dangling')
      .getByTestId('email-rule-edit-button')
      .click()
    const dialog = settings.ruleDialog
    const folder = dialog.getByTestId('rule-action-folder-button')
    await expect(folder).toHaveAccessibleName('Choose a folder')
    await dialog.getByTestId('rule-preview-toggle').click()
    await expect(dialog.getByTestId('rule-actions-preview')).toContainText(
      'Actions: Move message, Mark as seen'
    )

    await dialog.getByTestId('create-rule-button').click()
    await expect(folder).toBeFocused()
    await expect(folder).toHaveAttribute('aria-invalid', 'true')
    await expect(folder).toHaveAccessibleDescription(
      'Please select a mailbox to move the message'
    )
    await expect(dialog).toBeVisible()
    await expectNoA11yViolations(page)

    await folder.click()
    const picker = page.getByRole('dialog', { name: 'Choose a folder' })
    await picker.getByRole('option', { name: /Kept/ }).click()
    await expect(folder).toContainText('Kept')
    await expect(folder).not.toHaveAttribute('aria-invalid', 'true')
    await dialog.getByTestId('create-rule-button').click()
    await expect(dialog).toBeHidden()

    await expect
      .poll(async () => {
        const result = await jmap.call('Filter/get', { ids: ['singleton'] }, [
          FILTER
        ])
        return (result.list as { rules: unknown[] }[])[0]?.rules
      })
      .toEqual([
        expect.objectContaining({
          name: 'Dangling',
          action: expect.objectContaining({
            appendIn: { mailboxIds: [kept.id] },
            markAsSeen: true
          })
        })
      ])
  })
})
