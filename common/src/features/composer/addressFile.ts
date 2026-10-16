import { isValidEmail, parseRecipients, type Recipient } from './recipients'

/**
 * The addresses of a text file dropped on a recipient field (`tf#3268`):
 * one per line (`address` or `Name <address>`), blank lines and lines
 * starting with `#` ignored
 */
export interface AddressFile {
  recipients: Recipient[]
  /** The lines that are not one valid address, numbered from 1 */
  invalidLines: number[]
}

/** Whether a dropped file is read as a list of addresses */
export function isAddressFile(file: Pick<File, 'name' | 'type'>): boolean {
  return file.type === 'text/plain' || /\.txt$/i.test(file.name)
}

/** The only valid recipient of a line, null when it is not exactly one */
function lineRecipient(line: string): Recipient | null {
  const [recipient, ...others] = parseRecipients(line)
  return recipient !== undefined &&
    others.length === 0 &&
    isValidEmail(recipient.email)
    ? recipient
    : null
}

export function parseAddressFile(text: string): AddressFile {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((line, index) => ({ text: line.trim(), number: index + 1 }))
    .filter(line => line.text !== '' && !line.text.startsWith('#'))
    .map(line => ({ ...line, recipient: lineRecipient(line.text) }))
  return {
    recipients: lines.flatMap(line =>
      line.recipient === null ? [] : [line.recipient]
    ),
    invalidLines: lines
      .filter(line => line.recipient === null)
      .map(line => line.number)
  }
}
