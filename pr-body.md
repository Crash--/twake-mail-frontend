Closes #214

## Problem
`formatSize` used `Intl.NumberFormat` with `unitDisplay: 'short'` for every unit. In English (and Vietnamese) CLDR's short form of `byte` is "byte" whatever the count, so the composer and the reading view showed "29 byte" and "2 Attachments (104 byte)".

## Fix
Bytes now use `unitDisplay: 'long'`, which follows the plural rules of the language. Larger units keep the short form ("12.3 kB", "3,4 Mo"):

| lang | before | after |
|---|---|---|
| en | 29 byte | 29 bytes (1 byte) |
| fr | 29 o | 29 octets |
| ru | 29 Б | 29 байт |
| vi | 29 byte | 29 byte |

This fixes every caller (composer attachments, attachment list and total, print, preview limit, quota).

## Tests
- `formatSize.spec.ts`: updated the `512 bytes` expectation and added singular/plural cases (en, fr).
- I checked the Intl outputs above with `node -e`.
- **Not run:** `npm ci`, lint, format:check, typecheck, Jest. The sandbox only had Node 12, the install fails there (`tsdown`), and I was not allowed to switch to Node 24. CI has to validate these.

---
*Generated automatically*
