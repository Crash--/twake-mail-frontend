/**
 * The S/MIME signature check of the backend, in the `X-SMIME-Status` header
 * of an email (tmail-flutter#3023, #3031):
 *
 *     X-SMIME-Status: Good signature
 *     X-SMIME-Status: Bad signature
 *     X-SMIME-Status: Not signed
 *
 * "Not signed", any other value or no header: nothing is shown.
 */

/** Asked in `Email/get`, in the detail query of an email only */
export const SMIME_STATUS_HEADER = 'header:X-SMIME-Status:asText'

export type SmimeStatus = 'good' | 'bad' | 'not-signed'

/** The status of an email from the value of its header (null: not signed) */
export function parseSmimeStatus(
  value: string | null | undefined
): SmimeStatus {
  switch (value?.trim().toLowerCase()) {
    case 'good signature':
      return 'good'
    case 'bad signature':
      return 'bad'
    default:
      return 'not-signed'
  }
}
