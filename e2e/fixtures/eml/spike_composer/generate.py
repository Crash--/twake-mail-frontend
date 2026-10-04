#!/usr/bin/env python3
"""Generates the newsletter fixtures of the composer spike (run once, the .eml are committed).

newsletter.eml       a marketing email as Mailchimp-like tools write it: <style> with classes and
                     media queries, nested layout tables with bgcolor/width/align, a CTA button
                     table, <center>, <font>, a cid logo
newsletter-200k.eml  the same with its article block repeated up to ~200 KB of HTML (performance)
"""
import base64, struct, zlib

def png(width, height, rgb):
    raw = b''.join(b'\x00' + bytes(rgb) * width for _ in range(height))
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))

STYLE = """
<style type="text/css">
  body { margin: 0; padding: 0; background-color: #f4f4f7; font-family: Helvetica, Arial, sans-serif; }
  .wrapper { width: 100%; table-layout: fixed; background-color: #f4f4f7; }
  .main { background-color: #ffffff; margin: 0 auto; width: 600px; border-spacing: 0; }
  .heading { font-size: 26px; line-height: 32px; color: #1b1b3a; font-weight: bold; }
  .lead { font-size: 16px; line-height: 24px; color: #4a4a68; }
  .button a { display: inline-block; padding: 12px 24px; color: #ffffff !important; text-decoration: none; font-weight: bold; }
  .footer { font-size: 12px; color: #8c8ca1; }
  @media screen and (max-width: 600px) {
    .main { width: 100% !important; }
    .column { display: block !important; width: 100% !important; }
    .mobile-hide { display: none !important; }
  }
</style>"""

ARTICLE = """
<tr><td style="padding: 24px 32px 8px 32px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td class="column" width="50%" valign="top" style="padding-right: 12px;">
        <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #1b1b3a;">Article {n}: what changed this month</h2>
        <p class="lead" style="margin: 0 0 12px 0;">Lorem ipsum dolor sit amet, <strong>consectetur</strong> adipiscing elit. Integer
        nec odio. Praesent libero. Sed cursus ante dapibus diam. Sed nisi. <a href="https://example.com/a/{n}" style="color:#0b6e99;">Read more</a></p>
      </td>
      <td class="column" width="50%" valign="top" bgcolor="#eef4fb" style="padding: 12px; border-radius: 6px;">
        <font face="Georgia, serif" color="#6a1b9a" size="2"><i>Quote of the month {n}</i></font>
        <ul style="margin: 8px 0 0 18px; padding: 0; color: #4a4a68;">
          <li>First point</li><li>Second point with <em>emphasis</em></li>
        </ul>
      </td>
    </tr>
  </table>
</td></tr>"""

def html(articles):
    body = ''.join(ARTICLE.replace('{n}', str(n)) for n in range(1, articles + 1))
    return f"""<!DOCTYPE html>
<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">{STYLE}</head>
<body style="margin:0; padding:0; background-color:#f4f4f7;">
<center class="wrapper">
<table class="main" role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff">
  <tr><td align="center" bgcolor="#1b1b3a" style="padding: 20px;">
    <img src="cid:logo@newsletter" width="120" height="40" alt="ACME Weekly" style="display:block; border:0;">
  </td></tr>
  <tr><td style="padding: 32px 32px 0 32px;">
    <p class="heading" style="margin:0;">The ACME Weekly, October edition</p>
    <p class="lead" style="margin: 12px 0 0 0;">Hello! Here is what happened at ACME. <span class="mobile-hide">Desktop-only teaser.</span></p>
  </td></tr>
  <tr><td align="center" style="padding: 24px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="button">
      <tr><td align="center" bgcolor="#e8590c" style="border-radius: 4px;">
        <a href="https://example.com/cta" target="_blank" style="color:#ffffff; text-decoration:none; padding:12px 24px; display:inline-block; font-weight:bold;">Discover the offer</a>
      </td></tr>
    </table>
  </td></tr>
  {body}
  <tr><td class="footer" align="center" style="padding: 24px 32px; border-top: 1px solid #e4e4ec;">
    ACME Inc, 1 rue de la Paix, Paris<br>
    <a href="https://example.com/unsubscribe" style="color:#8c8ca1;">Unsubscribe</a> &middot; <a href="https://example.com/prefs" style="color:#8c8ca1;">Preferences</a>
  </td></tr>
</table>
</center>
</body></html>"""

def eml(subject, articles):
    logo = base64.encodebytes(png(120, 40, (232, 89, 12))).decode()
    content = html(articles)
    encoded = base64.encodebytes(content.encode()).decode()
    return f"""From: ACME Weekly <news@acme.example>
To: reader@example.com
Subject: {subject}
Date: Thu, 02 Oct 2026 09:30:00 +0200
Message-ID: <newsletter-{articles}@acme.example>
MIME-Version: 1.0
Content-Type: multipart/related; boundary="REL"

--REL
Content-Type: multipart/alternative; boundary="ALT"

--ALT
Content-Type: text/plain; charset=utf-8

The ACME Weekly, October edition

--ALT
Content-Type: text/html; charset=utf-8
Content-Transfer-Encoding: base64

{encoded}
--ALT--

--REL
Content-Type: image/png; name="logo.png"
Content-Transfer-Encoding: base64
Content-ID: <logo@newsletter>
Content-Disposition: inline; filename="logo.png"

{logo}
--REL--
""".replace('\n', '\r\n'), len(content)

for name, subject, articles in [('newsletter.eml', 'ACME Weekly newsletter', 3), ('newsletter-200k.eml', 'ACME Weekly heavy newsletter', 190)]:
    text, size = eml(subject, articles)
    open(name, 'w', newline='').write(text)
    print(name, 'html bytes', size)
