import {
  generateCalendarEventUrl,
  resolveChatSpaUrl
} from '@linagora/twake-utils'

export interface ContactLinksOptions {
  /** `CALENDAR_SPA_URL` and `CHAT_SPA_URL`, URI templates; null when unset */
  calendarSpaUrl: string | null
  chatSpaUrl: string | null
  workplaceFqdnFallback: string | null
  /** The address of the user, for `{localpart}` */
  username: string
}

export interface ContactLinks {
  /** A new event in Twake Calendar with the contact invited */
  invite: string | null
  /** A discussion with the contact in Twake Chat (Matrix) */
  chat: string | null
}

function localPart(address: string): string {
  return address.split('@')[0] ?? ''
}

/** Only web links: a template must not make a `javascript:` URL */
function onlyWebUrl(url: string | null): string | null {
  if (url === null) return null
  try {
    const { protocol, href } = new URL(url)
    return protocol === 'https:' || protocol === 'http:' ? href : null
  } catch {
    return null
  }
}

/**
 * Where the actions of the card of a contact lead, the way Twake Calendar
 * links its attendees: "Invite to an event" opens `/newEvent?attendee=` of
 * `CALENDAR_SPA_URL`, "Chat" opens `CHAT_SPA_URL` with `{target}` the local
 * part of the address. An action whose integration is not configured has no
 * link: the card does not offer it.
 */
export function contactLinks(
  email: string,
  {
    calendarSpaUrl,
    chatSpaUrl,
    workplaceFqdnFallback,
    username
  }: ContactLinksOptions
): ContactLinks {
  const context = {
    localpart: localPart(username),
    ...(workplaceFqdnFallback ? { workplaceFqdnFallback } : {})
  }
  return {
    invite: onlyWebUrl(
      calendarSpaUrl
        ? generateCalendarEventUrl(calendarSpaUrl, [email], context)
        : null
    ),
    chat: onlyWebUrl(
      chatSpaUrl
        ? resolveChatSpaUrl(chatSpaUrl, {
            ...context,
            target: localPart(email)
          })
        : null
    )
  }
}
