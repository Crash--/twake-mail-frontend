# S/MIME signature status (`X-SMIME-Status`)

Issue #553, after tmail-flutter#3023 and #3031. The backend checks the S/MIME
signature and tells the result in a header:

    X-SMIME-Status: Good signature
    X-SMIME-Status: Bad signature
    X-SMIME-Status: Not signed

- Fetched with `header:X-SMIME-Status:asText` in the detail query of an email
  only (`features/email/queries.ts`), never in list queries.
- Parser: `features/email/smimeStatus.ts`. Case and surrounding spaces are
  ignored; "Not signed", any other value or no header shows nothing.
- Display: `features/email/SmimeStatusMark.tsx`, right after the sender
  address (`SenderLine`), in the single email view and in each expanded
  message of a conversation. The icons of tmail-flutter (`GoodSignature`,
  `BadSignature` in `ds/FlutterIcons`), with the texts of tmail-flutter in a
  tooltip and as the name of the image, so that the state is not carried by
  its colour (`data-testid`: `email-smime-good-signature`,
  `email-smime-bad-signature`).
