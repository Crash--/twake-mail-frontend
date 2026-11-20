# Mail UX rules

Rules from the Twake design team that only Mail follows. The rules shared by every Twake app are in the `twake-ux` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines); decisions already taken are in [`docs/decisions.md`](docs/decisions.md).

## Email list row

Source: Swann Maillard (design), Matrix, 2026-11-18. Scope: desktop. On mobile, the current row stays as it is.

- The subject and the preview share one line.
- The subject takes at most 55% of the row's width once the icons, avatar, date and actions are taken off; the preview takes the rest.
- Both end with an ellipsis when they overflow, and never wrap.
- A short subject keeps its natural width, and the preview starts right after it.
- With no preview, the subject takes the whole width.
