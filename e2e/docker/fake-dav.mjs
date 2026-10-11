// A fake of the OpenPaaS API and of esn-sabre (CalDAV) of a Twake Workplace, for the calendar
// specs (CAL-06, CAL-07): just what tmail-backend calls to answer an invitation
// (`CalendarEvent/accept`, `maybe`, `reject`), read the answer back
// (`CalendarEventAttendance/get`) and accept a counter proposal (`CalendarEventCounter/accept`).
// See com.linagora.tmail.dav.CalDavClient and com.linagora.tmail.api.OpenPaasRestClient in
// tmail-backend. james/openpaas.properties points both URIs here.
//
// Each user has one calendar, /calendars/<email>/<email>/, kept in memory: the OpenPaaS user id
// is the email address itself. The events are stored as tmail-backend sends them, without
// any CalDAV logic (no scheduling, no recurrence expansion).
//
//   GET      /api/users?email=<email>               the OpenPaaS user
//   PROPFIND /                                      the principal (auto-provisioning)
//   PROPFIND /calendars/<id>                        the calendars of the user
//   REPORT   /calendars/<id>/<id>/                  the event of a UID (calendar-query)
//   GET|PUT  /calendars/<id>/<id>/<uid>.ics         an event (ETag, If-Match)
//   POST     /calendars/freebusy                    never busy
//
// The proxy exposes it on /e2e/caldav/ so that a spec puts the event in the calendar first, as
// esn-sabre does when the invitation arrives: tmail-backend only falls back to importing it
// with an `ITIP` request, a method the HTTP parser of Node refuses (400).
import { createServer } from 'node:http'

const PORT = 8080
/** `${calendarPath}${uid}.ics` -> { ics, etag } */
const objects = new Map()
let etagCounter = 0

const xmlEscape = value =>
  value.replace(
    /[<>&'"]/g,
    c =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[
        c
      ]
  )

const calendarPath = id => `/calendars/${id}/${id}/`

const store = (href, ics) => {
  etagCounter += 1
  const etag = `"e2e-${etagCounter}"`
  // A calendar object carries no METHOD (RFC 4791 §4.1)
  objects.set(href, { ics: ics.replace(/^METHOD:.*\r?\n/m, ''), etag })
  return etag
}

const multistatus = responses =>
  `<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">${responses.join('')}</d:multistatus>`

const response = (href, prop) =>
  `<d:response><d:href>${xmlEscape(href)}</d:href><d:propstat><d:prop>${prop}</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`

const send = (res, status, body = '', headers = {}) => {
  res.writeHead(status, headers)
  res.end(body)
}

const readBody = req =>
  new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })

const handle = async (req, res) => {
  const url = new URL(req.url, 'http://fake-dav')
  const path = decodeURIComponent(url.pathname)
  const body = await readBody(req)
  const xml = { 'Content-Type': 'application/xml; charset=utf-8' }

  if (req.method === 'GET' && path === '/api/users') {
    const email = url.searchParams.get('email') ?? ''
    const user = { _id: email, preferredEmail: email, emails: [email] }
    return send(res, 200, JSON.stringify([user]), {
      'Content-Type': 'application/json'
    })
  }
  if (req.method === 'PROPFIND' && path === '/') {
    return send(res, 207, multistatus([]), xml)
  }
  if (req.method === 'POST' && path === '/calendars/freebusy') {
    const { start, end } = JSON.parse(body || '{}')
    return send(res, 200, JSON.stringify({ start, end, users: [] }), {
      'Content-Type': 'application/json'
    })
  }

  const user = /^\/calendars\/([^/]+)\/?$/.exec(path)
  if (user !== null && req.method === 'PROPFIND') {
    const id = user[1]
    return send(
      res,
      207,
      multistatus([
        response(
          `/calendars/${id}/`,
          '<d:resourcetype><d:collection/></d:resourcetype>'
        ),
        response(
          calendarPath(id),
          '<d:resourcetype><d:collection/><cal:calendar/></d:resourcetype>'
        )
      ]),
      xml
    )
  }

  if (req.method === 'REPORT' && /^\/calendars\/[^/]+\/[^/]+\/$/.test(path)) {
    const uid = /<C:text-match[^>]*>([^<]*)<\/C:text-match>/i.exec(body)?.[1]
    const href = `${path}${uid}.ics`
    const object = objects.get(href)
    const found =
      object === undefined
        ? []
        : [
            response(
              href,
              `<d:getetag>${xmlEscape(object.etag)}</d:getetag><cal:calendar-data>${xmlEscape(object.ics)}</cal:calendar-data>`
            )
          ]
    return send(res, 207, multistatus(found), xml)
  }

  if (/^\/calendars\/[^/]+\/[^/]+\/[^/]+\.ics$/.test(path)) {
    const object = objects.get(path)
    if (req.method === 'GET') {
      return object === undefined
        ? send(res, 404)
        : send(res, 200, object.ics, {
            'Content-Type': 'text/calendar; charset=utf-8',
            ETag: object.etag
          })
    }
    if (req.method === 'PUT') {
      const ifMatch = req.headers['if-match']
      if (ifMatch !== undefined && ifMatch !== object?.etag) {
        return send(res, 412)
      }
      const etag = store(path, body)
      return send(res, object === undefined ? 201 : 204, '', { ETag: etag })
    }
  }

  console.log(`fake-dav: no answer for ${req.method} ${req.url}`)
  return send(res, 404)
}

createServer((req, res) => {
  handle(req, res).catch(error => {
    console.error(`fake-dav: ${req.method} ${req.url}`, error)
    send(res, 500)
  })
}).listen(PORT, () => console.log(`fake-dav listening on ${PORT}`))
