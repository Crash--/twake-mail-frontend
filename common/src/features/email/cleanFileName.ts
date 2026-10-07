/** Line breaks and tabs become spaces */
const CONTROL_WHITESPACE = /[\t\n\v\f\r\u0085]+/g

// eslint-disable-next-line no-control-regex -- control characters are dropped
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g

/** Bidi marks, embeddings, overrides and isolates: they can spoof an extension */
const BIDI_CONTROLS = /[؜‎‏‪-‮⁦-⁩]/g

/**
 * The name of a file as shown, announced and saved: without control
 * characters nor bidi controls ("invoice‮txt.exe" would read
 * "invoiceexe.txt"), `null` when nothing is left.
 */
export function cleanFileName(name: string | null | undefined): string | null {
  const clean = (name ?? '')
    .replace(CONTROL_WHITESPACE, ' ')
    .replace(CONTROL_CHARACTERS, '')
    .replace(BIDI_CONTROLS, '')
    .trim()
  return clean === '' ? null : clean
}
