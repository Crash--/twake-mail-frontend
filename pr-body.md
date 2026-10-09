Closes #360

## What

`FilePreviewDialog` (`common/src/ds/FilePreviewDialog/`) is a full-screen MUI `Dialog`, so its backdrop is never reachable and clicking the dark area around a previewed file did nothing. The scrollable body now closes the dialog when the click lands on the background itself (not on the file), for all previews built on it: PDF, EML, text, HTML and images.

As with the MUI backdrop, both the press and the release must happen on the background: dragging a text selection out of the file and releasing it over the background does not close the preview. Keyboard users keep Escape and the close button. Clicks inside the email or HTML iframe never reach the parent, so they cannot close the preview.

Limitation: the narrow gaps between PDF pages belong to the PDF container, not to the background, so clicking them does not close the preview.

## Tests

- `FilePreviewDialog.spec.tsx`: a click on the file does not close the preview and a click on the background does; a press on the file released on the background does not close it.

## Checks

**Not run.** Only Node 12 was available in this environment, and loading Node 24 through nvm, which `npm ci`, lint, typecheck and Jest need, required an approval I could not get. I formatted the code by hand to match the Prettier config. CI must confirm `lint`, `format:check`, `typecheck`, `test` and `build`.

---
*Generated automatically*
