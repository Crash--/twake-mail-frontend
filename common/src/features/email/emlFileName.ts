const MAX_NAME_LENGTH = 150

/**
 * The file name of an email saved as EML: its subject, as tmail-flutter, or
 * the id of its blob when it has none. Characters a file system or a path
 * would read are replaced.
 */
export function emlFileName(
  subject: string | null | undefined,
  blobId: string
): string {
  const name = (subject ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, '_')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, MAX_NAME_LENGTH)
    .trim()
  return `${name === '' ? blobId : name}.eml`
}
