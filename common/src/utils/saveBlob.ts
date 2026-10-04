/**
 * Saves a blob as a file, through a temporary object URL: the JMAP download
 * endpoint needs the Authorization header, so a plain link cannot be used.
 */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  // Let the browser start the download before releasing the blob
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 0)
}
