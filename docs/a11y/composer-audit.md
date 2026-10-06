# Composer: RGAA 4.1 audit grid

Point 1 of [#65](https://github.com/Crash--/twake-mail-frontend/issues/65). What can be checked
without a screen reader is checked by `e2e/tests/composer-a11y.spec.ts` (`A11Y-10` to `A11Y-14`: the
accessibility tree of each state with `toMatchAriaSnapshot`, names, roles, states, live regions, the
order of the focus and where it comes back) and by axe in every composer spec (WCAG 2.0/2.1 A and
AA). **The audit with NVDA (Firefox, Chrome) and VoiceOver (Safari macOS, iOS) is still to do**:
the lines "à vérifier au lecteur d'écran" are its list.

Colour contrast (3.2, 3.3) is deferred to a dedicated theme (`AGENTS.md`): axe reports it as an
annotation and it is not graded here.

Result: **C** conforme, **NC** non conforme, **PC** partiellement conforme, **NA** non applicable.
Method: **auto** (a spec fails if it regresses) or **à vérifier au lecteur d'écran**.

## States covered

Window (docked, minimized, full screen, two windows side by side), recipient chips (typed, pasted,
invalid, edited, removed), formatting toolbar and Alt+F10, image toolbar, link dialog, attachments,
send checks and the close dialog, toasts, "Insert template" picker.

## Grid

| Criterion RGAA 4.1 | Result | How it is checked | Fix or issue |
|---|---|---|---|
| 1.1 Each informative image has a text alternative | C (fixed in E8, #159) | auto (`A11Y-15`: the field, Enter, Escape, `alt=""`; `A11Y-12`) | An image inserted in the body starts decorative (`alt=""`), not named after its file, and the image toolbar has an "Alternative text" field. Not done: a warning before sending an image left without text (an empty text is a valid choice, see the PR) |
| 1.2 Decorative images are ignored | C | auto (axe `image-alt`, snapshots: avatars and icons are `aria-hidden`) | |
| 2.1 Each frame has a title | C | auto (axe `frame-title`; the quote block frame is titled by `composer.quote.frameTitle`) | |
| 3.1 Information is not given by colour alone | C | auto (`A11Y-11`: the invalid address is named "wrong, invalid address", outlined, with a warning icon) | |
| 3.2, 3.3 Contrast | – | deferred (theme) | |
| 5.x Data tables | NA | | Tables written by the user in the body are content of the message, not of the interface |
| 6.1 Each link has an explicit name | C | auto (axe `link-name`; the dialog asks for the text and the address) | |
| 7.1 Scripts are compatible with assistive technologies | C | auto (ARIA 1.2 combobox of the recipients, roving toolbar with `aria-pressed`, dialogs named and labelled) | The roles and names are read as intended: à vérifier au lecteur d'écran |
| 7.2 Alternatives to the scripted content | C | auto | |
| 7.3 Scripts can be driven by the keyboard | C (fixed in E8, #160) | auto (`CMP-27` to `CMP-33`, `A11Y-10` to `A11Y-16`) | Escape while a chip is edited gives the chip back, in its place, and stops there (the suggestions close with the same key); the next Escape is the window's (`A11Y-16`) |
| 7.4 A change of context is announced or controlled | C (fixed here) | auto (`A11Y-14`) | "Add recipients" of the send check put the focus back on Send, not in To: it goes to To now |
| 7.5 Status messages are announced | C (fixed in E8, #161; what is heard: à vérifier au lecteur d'écran) | auto for the regions (`A11Y-10`: three `role="status"` are mounted before anything is said; `A11Y-11`: "Carol removed"; `A11Y-13`: "report.txt attached", toasts in a polite status and an alert region). What is heard: à vérifier au lecteur d'écran | "Draft saved" is said once: a save asked for by the toast, an autosave by the live region `composer-save-announcement`; the status line of the window is plain text (`A11Y-17`). Adding a chip is announced like removing one ("alice@example.com added", "3 recipients added") |
| 8.2 The generated code is valid | C | auto (axe, jsx-a11y) | |
| 8.7, 8.8 Language | C | auto (`<html lang>` follows the interface) | |
| 9.1 The information is structured by headings | C (fixed in E8, #162) | auto (the window title is a level 2 heading, the dialogs too; `A11Y-18`) | The title of the minimized window is plain text in its button (no heading), the name of the button is unchanged ("Show: Subject") |
| 9.2 The structure of the document is coherent | C | auto (a window is a `dialog`, the page keeps its `main` and `navigation`) | |
| 9.3 Lists are structured as lists | C | auto (`A11Y-13`: "Attachments (2)" is a list of list items) | |
| 10.4 Text is resizable to 200 % | C | à vérifier (zoom): the geometry is tested at 390, 820 and 1440 px (`CMP-84` to `CMP-98`) | |
| 10.7 The focus is visible | C | à vérifier visuellement (outline of the design system); the order is tested | |
| 10.11 Content can be reflowed at 320 px | C (fixed in E8, #163) | auto (`CMP-84` to `CMP-98`: the geometry of the window; `CMP-100`: 200 recipients) | Each recipient field shows 3 rows of chips at most and scrolls inside, the focused chip and the input staying in view: with 200 recipients in To the body keeps 317 of 393 px on a desktop (66 of 634 before) |
| 10.x Out-of-view content (`content-visibility: auto`, this lot) | C | à vérifier au lecteur d'écran: the text stays in the accessibility tree and in the page search; the scrollbar of a very long message may move while it is scrolled (the height of a block not seen yet is estimated) | |
| 11.1 Each form field has a label | C | auto (To, Subject and the body are named; the body by `aria-label`, its keyboard help by `aria-describedby`) | |
| 11.2 The labels are pertinent | C | auto (snapshots) | |
| 11.5, 11.6 Fields are grouped and the group is named | C | auto (`group "To"`) | |
| 11.9 The name of a button is explicit | C | auto (every icon button has an `aria-label` and the same tooltip; `Send`, `Save & close`, `Remove report.txt`) | |
| 11.10, 11.11 Input is checked and helped | C | auto (`A11Y-11`, `A11Y-14`: an invalid address is named, the send checks say what is missing in a dialog) | |
| 11.12 Data that matter can be corrected | C | auto (`A11Y-13`, the close dialog "Save message" asks before losing the message) | |
| 11.13 The purpose of fields is defined (`autocomplete`) | NA | | They are other people's addresses and a subject |
| 12.6 The zones of the page can be reached | C | auto (landmarks of the page; the window is a dialog reachable by Tab and its minimized title) | |
| 12.8 The tab order is coherent | C | auto (`A11Y-10`: body, toolbar (one stop), footer buttons, Send) | |
| 12.9 No keyboard trap | C | auto (`CMP-29`: Tab leaves the editor; Alt+F10 and Escape go to the toolbar and back) | |
| 12.10 Single-key shortcuts can be turned off | C | auto (`KBD-02`); the composer only adds Alt+F10 and Ctrl+K, which use a modifier | |
| 13.1 The user controls time limits | C | auto (the toasts stop their countdown while hovered or focused, `ToastRegion.spec`); the draft is kept in the browser | |
| 13.2 No window opens without warning | NA | | |
| 13.7, 13.8 Moving content | NA | | |
| 13.9 Content is not limited to one orientation | C | auto (tablet and phone projects) | |
| 13.12 Complex gestures have an alternative | C | auto (`CMP-77`: dropping files has the "Attach file" button; resizing an image has a toolbar) | |
| Focus: opening a dialog moves the focus in, closing gives it back | C | auto (`A11Y-10` to `A11Y-14`: minimize, full screen, link dialog, picker, close dialog, send check) | |

## What this audit could not do

- **Read with NVDA and VoiceOver** (desktop and iOS): the order and the words of what is said, the
  double "Draft saved", the heading in the minimized title, the chips as buttons with a help text,
  the toolbar with its roving focus, the combobox of the recipients (ARIA 1.2 pattern).
- **Contrast** (deferred, see above).
- Zoom, Windows high contrast, `prefers-reduced-motion` in the composer.

## Issues (opened, fixed in the lot E8)

1. [#159](https://github.com/Crash--/twake-mail-frontend/issues/159) Alternative text of the images inserted in the body (1.1).
2. [#160](https://github.com/Crash--/twake-mail-frontend/issues/160) Escape while a chip is edited (7.3).
3. [#161](https://github.com/Crash--/twake-mail-frontend/issues/161) "Draft saved" announced twice, chip added never (7.5).
4. [#162](https://github.com/Crash--/twake-mail-frontend/issues/162) Heading inside the button of the minimized window (9.1).
5. [#163](https://github.com/Crash--/twake-mail-frontend/issues/163) 200 recipients take the whole window (10.11).
