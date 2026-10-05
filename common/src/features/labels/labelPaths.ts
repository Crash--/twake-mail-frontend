/** Path of the emails of a label: `/label/<id>` */
export const LABEL_PATH = '/label'

export function labelPath(labelId: string): string {
  return `${LABEL_PATH}/${encodeURIComponent(labelId)}`
}

export function labelEmailPath(labelId: string, emailId: string): string {
  return `${labelPath(labelId)}/email/${encodeURIComponent(emailId)}`
}
