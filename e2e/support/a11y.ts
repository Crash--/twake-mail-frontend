import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/** RGAA 4.1 is close to WCAG 2.1 AA: the rules axe tags for levels A and AA */
export const WCAG_AA_TAGS: readonly string[] = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa'
]

/**
 * A violation that comes from @linagora/twake-mui itself, recorded in docs/twake-mui-gaps.md
 * (section "Accessibility"). It does not fail the test but is reported as an annotation, so
 * that it stays visible until twake-mui fixes it. Never add an app-side violation here.
 */
export interface KnownViolation {
  rule: string
  /** CSS selector the offending element matches (axe truncates its HTML) */
  selector: string
  /** Where it is documented */
  reason: string
}

export const TWAKE_MUI_KNOWN_VIOLATIONS: readonly KnownViolation[] = [
  {
    rule: 'color-contrast',
    selector: '.MuiInputLabel-root',
    reason:
      'twake-mui TextField label: text.secondary on white, 3.6:1 (docs/twake-mui-gaps.md)'
  },
  {
    rule: 'color-contrast',
    selector: '.MuiButton-contained',
    reason:
      'twake-mui contained primary Button: white on #0a84ff, 3.6:1 (docs/twake-mui-gaps.md)'
  },
  {
    rule: 'color-contrast',
    selector: '.MuiButton-text.MuiButton-colorPrimary',
    reason:
      'twake-mui text primary Button: #0a84ff on white, 3.6:1 (docs/twake-mui-gaps.md)'
  },
  {
    rule: 'color-contrast',
    selector:
      '.MuiListItemButton-root.Mui-selected, .MuiListItemButton-root.Mui-selected *',
    reason:
      'twake-mui selected NavLink: #0a84ff on #e5e8eb, 3.0:1 (docs/twake-mui-gaps.md)'
  }
]

async function matches(
  page: Page,
  target: string,
  selector: string
): Promise<boolean> {
  return page.evaluate(
    ([elementSelector, knownSelector]) =>
      document.querySelector(elementSelector)?.matches(knownSelector) ?? false,
    [target, selector] as const
  )
}

export interface A11yOptions {
  /** Defaults to the twake-mui violations above */
  known?: readonly KnownViolation[]
}

interface ReportedNode {
  target: string
  html: string
  summary: string
}

interface ReportedViolation {
  rule: string
  impact: string | null
  help: string
  nodes: ReportedNode[]
}

/**
 * Runs axe (WCAG 2.0 / 2.1, A and AA) on the page as it is, and fails with the list of
 * violations: rule, impact, offending elements. Call it once the screen under test is
 * rendered. Frames are not entered: the only frame of the app is the sandboxed email body,
 * which runs no script (axe cannot run in it) and holds the sender's content, not ours; the
 * frame element itself is checked (`frame-title`).
 */
export async function expectNoA11yViolations(
  page: Page,
  { known = TWAKE_MUI_KNOWN_VIOLATIONS }: A11yOptions = {}
): Promise<void> {
  const { violations } = await new AxeBuilder({ page })
    .setLegacyMode(true)
    .options({
      iframes: false,
      runOnly: { type: 'tag', values: [...WCAG_AA_TAGS] }
    })
    .analyze()

  const report: ReportedViolation[] = []
  for (const violation of violations) {
    const nodes: ReportedNode[] = []
    for (const node of violation.nodes) {
      const target = node.target.join(' ')
      let knownViolation: KnownViolation | undefined
      for (const candidate of known) {
        if (
          candidate.rule === violation.id &&
          (await matches(page, target, candidate.selector))
        ) {
          knownViolation = candidate
          break
        }
      }
      if (knownViolation === undefined) {
        nodes.push({
          target,
          html: node.html.slice(0, 200),
          summary: node.failureSummary ?? ''
        })
      } else {
        test.info().annotations.push({
          type: 'known twake-mui a11y violation',
          description: `${violation.id} on ${target}: ${knownViolation.reason}`
        })
      }
    }
    if (nodes.length > 0) {
      report.push({
        rule: violation.id,
        impact: violation.impact ?? null,
        help: violation.help,
        nodes
      })
    }
  }
  expect(report, `axe violations on ${page.url()}`).toEqual([])
}
