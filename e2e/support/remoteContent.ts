import type { JmapClient } from './jmap'

/**
 * Turns "Block remote images and third-party content" on for the user, as
 * the preferences do (it is off by default)
 */
export async function blockRemoteContent(jmap: JmapClient): Promise<void> {
  await jmap.call(
    'Settings/set',
    {
      update: { singleton: { 'settings/display.remote.images': 'false' } }
    },
    ['com:linagora:params:jmap:settings']
  )
}
