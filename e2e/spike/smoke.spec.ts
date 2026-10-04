import { expect, test } from '../support/fixtures'
import { SpikeComposer } from './SpikeComposer'

test('SPIKE smoke: the spike composer renders', async ({ page, user }) => {
  const errors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  const composer = await new SpikeComposer(page).open(user)
  await expect(composer.toolbar).toBeVisible()
  await composer.shot('smoke')
  expect(errors).toEqual([])
})
