// Applications listed in the app grid of the top bar, in this order, each
// opened in a new tab. `link` and `icon` may be URI templates, resolved for
// the user: {localpart}, {workplaceFqdn}, {workplaceFqdn.localpart},
// {workplaceFqdn.domain} (the `workplaceFqdn` claim of the SSO, or else
// WORKPLACE_FQDN_FALLBACK of .env.js). An app whose link cannot be resolved
// is left out.
// Copy this file to `public/appList.js` (development) or mount it as
// `/usr/share/nginx/html/appList.js` (Docker image).
var appList = [
  {
    name: 'Chat',
    link: 'https://chat.example.com',
    icon: '/assets/images/svg/app-chat.svg'
  },
  {
    name: 'Drive',
    // The Twake Drive of each user has its own address
    link: 'https://{workplaceFqdn.localpart}-drive.{workplaceFqdn.domain}',
    icon: '/assets/images/svg/app-drive.svg'
  },
  {
    name: 'Calendar',
    link: 'https://calendar.example.com',
    icon: '/assets/images/svg/app-calendar.svg'
  }
]
