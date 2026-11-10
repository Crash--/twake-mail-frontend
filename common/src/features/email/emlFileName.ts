const MAX_NAME_LENGTH = 150

/**
 * The file name of an email saved as EML: its subject, as tmail-flutter, or
 * the id of its blob when it has none. Characters a file system or a path
 * would read are replaced. The name neither starts nor ends with a dot or a
 * space: its end is trimmed after the cut, which can fall in a run of them.
 */
export function emlFileName(
  subject: string | null | undefined,
  blobId: string
): string {
  const name = (subject ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, '_')
    .replace(/^[\s.]+/, '')
    .slice(0, MAX_NAME_LENGTH)
    // a cut between the two halves of a surrogate pair
    .replace(/[\uD800-\uDBFF]$/, '')
    // (?<!…): a run is tried from its first character only (ReDoS)
    .replace(/(?<![\s.])[\s.]+$/, '')
  return `${name === '' ? blobId : name}.eml`
}
