// Apps of the app grid of the app under test (see public/appList.example.js),
// served as /appList.js by the stack's nginx (APPGRID-01). The hosts do not
// exist: the spec answers them itself. Drive is a URI template, resolved per
// user with WORKPLACE_FQDN_FALLBACK (docker/app-env.js).
var appList = [
  {
    name: 'Twake Chat',
    link: 'https://chat.workplace.example.test/',
    icon: '/assets/images/svg/app-chat.svg'
  },
  {
    name: 'Twake Drive',
    link: 'https://{workplaceFqdn.localpart}-drive.{workplaceFqdn.domain}/',
    icon: '/assets/images/svg/app-drive.svg'
  },
  {
    name: 'Twake Calendar',
    link: 'https://calendar.workplace.example.test/',
    icon: '/assets/images/svg/app-calendar.svg'
  }
]
