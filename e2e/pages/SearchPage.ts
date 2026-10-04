import { expect, type Locator, type Page } from '@playwright/test'

import { EmailPage } from './EmailPage'

/** The quick filters under the search field while typing */
export type QuickSearchFilter =
  'has-attachment' | 'last-7-days' | 'from-me' | 'starred'

/** The filters above the results */
export type SearchFilterChip =
  'folder' | 'date-time' | 'has-attachment' | 'starred' | 'unread' | 'sort-by'

/** Below this width the search field is folded behind a button of the top bar */
const PHONE_MAX_WIDTH = 600

/**
 * The search: the field of the top bar with its suggestions and quick filters, the advanced
 * search dialog, and the results (`/search?…`) with their filters.
 * Patrol counterparts: robots/search_robot.dart, robots/web/web_search_*_robot.dart.
 */
export class SearchPage {
  readonly page: Page
  readonly input: Locator
  readonly openButton: Locator
  readonly suggestions: Locator
  readonly suggestionItems: Locator
  readonly showAllSuggestion: Locator
  readonly advancedButton: Locator
  readonly advancedDialog: Locator
  readonly advancedSubmitButton: Locator
  readonly advancedCancelButton: Locator
  /** The live region of the field: number of suggestions, loading */
  readonly status: Locator
  readonly results: Locator
  readonly resultsTitle: Locator
  readonly resultsBackButton: Locator
  readonly emailList: Locator
  readonly emptyView: Locator
  readonly filterMenu: Locator

  constructor(page: Page) {
    this.page = page
    this.input = page.getByTestId('search-input')
    this.openButton = page.getByTestId('search-open-button')
    this.suggestions = page.getByTestId('search-suggestions')
    this.suggestionItems = this.suggestions.getByTestId(
      'search-suggestion-item'
    )
    this.showAllSuggestion = this.suggestions.getByTestId(
      'search-suggestion-show-all'
    )
    this.advancedButton = page.getByTestId('advanced-search-button')
    this.advancedDialog = page.getByTestId('advanced-search-dialog')
    this.advancedSubmitButton = page.getByTestId(
      'advanced-search-submit-button'
    )
    this.advancedCancelButton = page.getByTestId(
      'advanced-search-cancel-button'
    )
    this.status = page.getByTestId('search-bar').getByRole('status')
    this.results = page.getByTestId('search-results')
    this.resultsTitle = page.getByTestId('search-results-title')
    this.resultsBackButton = page.getByTestId('search-results-back-button')
    this.emailList = this.results.getByTestId('email-list')
    this.emptyView = page.getByTestId('empty-search-view')
    this.filterMenu = page.getByTestId('search-filter-menu')
  }

  isPhone(): boolean {
    return (
      (this.page.viewportSize()?.width ?? PHONE_MAX_WIDTH) < PHONE_MAX_WIDTH
    )
  }

  /** Shows the field (unfolds it on phones) and focuses it */
  async focusField(): Promise<SearchPage> {
    if (this.isPhone() && !(await this.input.isVisible())) {
      await this.openButton.click()
    }
    await this.input.click()
    await expect(this.input).toBeFocused()
    return this
  }

  /** Types in the field, as a user does, replacing what it held */
  async type(text: string): Promise<SearchPage> {
    await this.focusField()
    await this.input.fill(text)
    return this
  }

  /** Types and submits: the results of that text */
  async search(text: string): Promise<SearchPage> {
    await this.type(text)
    await this.input.press('Enter')
    await this.expectResults()
    return this
  }

  async expectResults(): Promise<SearchPage> {
    await expect(this.results).toBeVisible()
    return this
  }

  /** A quick filter chip of the suggestions (`aria-pressed` when applied) */
  quickFilter(filter: QuickSearchFilter): Locator {
    return this.page.getByTestId(`quick-search-filter-${filter}`)
  }

  /** A filter chip above the results */
  filterChip(filter: SearchFilterChip): Locator {
    return this.page.getByTestId(`search-filter-${filter}`)
  }

  /** Picks a value of a menu filter (folder, date, sort) by its label */
  async pickFilter(
    filter: SearchFilterChip,
    label: string
  ): Promise<SearchPage> {
    await this.filterChip(filter).click()
    await expect(this.filterMenu).toBeVisible()
    await this.filterMenu
      .getByRole('menuitemradio', { name: label, exact: true })
      .click()
    await expect(this.filterMenu).toBeHidden()
    return this
  }

  /** The result row of an email, by exact subject */
  resultRow(subject: string): Locator {
    return this.emailList.getByTestId('email-list-item').filter({
      has: this.page
        .getByTestId('email-list-item-subject')
        .getByText(subject, { exact: true })
    })
  }

  /** The subjects of the results, in their order */
  async resultSubjects(): Promise<string[]> {
    return this.emailList.getByTestId('email-list-item-subject').allInnerTexts()
  }

  async openAdvanced(): Promise<Locator> {
    await this.focusField()
    await this.advancedButton.click()
    await expect(this.advancedDialog).toBeVisible()
    return this.advancedDialog
  }

  async openResult(subject: string): Promise<EmailPage> {
    await this.resultRow(subject).click()
    const email = new EmailPage(this.page)
    await email.expectSubject(subject)
    return email
  }
}
