/**
 * What holds the actions of a row: a table row, a list item (a folder), or
 * a row of a settings list (a profile)
 */
export const ROW_CONTAINERS = {
  tableRow: '.MuiTableRow-root',
  listItem: '.MuiListItem-root',
  settingsItem: '[data-settings-item]'
} as const
