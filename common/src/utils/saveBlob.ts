/**
 * Saves a blob as a file, through a temporary object URL: the JMAP download
 * endpoint needs the Authorization header, so a plain link cannot be used.
 * The link is clicked in `page`, the document the user clicked in: a frame
 * the user did not click in (the app's, under the overlay of TwakeSpace)
 * may not start a download.
 */
export function saveBlob(
  blob: Blob,
  fileName: string,
  page: Document = document
): void {
  const url = URL.createObjectURL(blob)
  const link = page.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  page.body.append(link)
  link.click()
  link.remove()
  // Let the browser start the download before releasing the blob
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 0)
}
