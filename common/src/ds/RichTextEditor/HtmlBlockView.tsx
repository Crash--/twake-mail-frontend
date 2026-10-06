// Upstream to twake-ui: with HtmlBlock (see htmlBlock.ts).
import { Bottom, Icon, Top } from '@linagora/twake-icons'
import { Box, Button } from '@linagora/twake-mui'
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { useEffect, useRef, useState, type ReactElement } from 'react'

import type { HtmlBlockOptions } from './htmlBlock'

const MIN_FRAME_HEIGHT = 24

/**
 * The frame of a `frame` block, as high as its content. No `allow-scripts`:
 * nothing in it can run; `allow-same-origin` only lets the editor measure
 * it. Loaded from a `blob:` URL rather than `srcdoc`: Chromium sends the
 * origin of the page as referrer for the CSS images of a `srcdoc` frame,
 * whatever its referrer policy; a `blob:` document sends none.
 */
function HtmlBlockFrame({
  document,
  title
}: {
  document: string
  title: string
}): ReactElement {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const [height, setHeight] = useState(MIN_FRAME_HEIGHT)

  useEffect(() => () => observerRef.current?.disconnect(), [])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const objectUrl = URL.createObjectURL(
      new Blob([document], { type: 'text/html' })
    )
    frame.src = objectUrl
    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [document])

  const handleLoad = (): void => {
    observerRef.current?.disconnect()
    const body = frameRef.current?.contentDocument?.body
    if (!body) return
    const measure = (): void => {
      setHeight(Math.max(Math.ceil(body.scrollHeight), MIN_FRAME_HEIGHT))
    }
    measure()
    // The window the node is rendered in, maybe not this one (the overlay of
    // TwakeSpace): an observer only follows the documents of its own window
    const view = frameRef.current?.ownerDocument.defaultView ?? window
    const observer = new view.ResizeObserver(measure)
    observer.observe(body)
    observerRef.current = observer
  }

  return (
    <Box
      component="iframe"
      ref={frameRef}
      title={title}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      width="100%"
      height={height}
      onLoad={handleLoad}
      // A preview: a click selects the block in the editor instead of
      // putting the focus in a document where typing goes nowhere; screen
      // readers still read it
      tabIndex={-1}
      sx={{ display: 'block', border: 0, pointerEvents: 'none' }}
    />
  )
}

/** The node view of HtmlBlock: the HTML, framed or not, and its edit button */
export function HtmlBlockView({
  node,
  extension,
  editor,
  getPos,
  selected
}: ReactNodeViewProps): ReactElement {
  // SAFETY: the view is only registered by the HtmlBlock extension
  const options = extension.options as HtmlBlockOptions
  const kind = String(node.attrs.kind)
  const html = String(node.attrs.html)
  const editLabel = options.editLabel(kind)
  const toggleLabel =
    node.attrs.display === 'inline' ? options.toggleLabel(kind) : null
  const [isUnfolded, setIsUnfolded] = useState(true)

  const handleEdit = (): void => {
    const position = getPos()
    if (typeof position === 'number') {
      editor.chain().focus().unwrapHtmlBlock(position).run()
    }
  }

  return (
    <NodeViewWrapper data-html-block-view={kind} contentEditable={false}>
      <Box
        sx={{
          position: 'relative',
          borderRadius: 1,
          outline: selected ? '2px solid' : 'none',
          outlineColor: 'primary.main'
        }}
      >
        {toggleLabel === null ? null : (
          <Button
            variant="outlined"
            color="inherit"
            aria-expanded={isUnfolded}
            onClick={() => {
              setIsUnfolded(unfolded => !unfolded)
            }}
            endIcon={<Icon icon={isUnfolded ? Top : Bottom} size={16} />}
            sx={{
              borderRadius: '100px',
              borderColor: 'text.secondary',
              color: 'text.secondary',
              px: 2,
              textTransform: 'none',
              fontWeight: 500,
              fontSize: 14,
              lineHeight: '20px',
              letterSpacing: '0.1px',
              mb: 0.5
            }}
            data-testid={options.toggleTestId(kind)}
          >
            {toggleLabel}
          </Button>
        )}
        {node.attrs.display === 'inline' ? (
          <Box
            hidden={!isUnfolded}
            sx={
              toggleLabel === null
                ? undefined
                : {
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: '8px',
                    bgcolor: 'background.paper',
                    p: 2,
                    overflow: 'auto'
                  }
            }
            // Sanitized by whoever inserted the block (see HtmlBlock)
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <HtmlBlockFrame
            document={options.buildFrameDocument(html)}
            title={options.frameTitle(kind)}
          />
        )}
        {editLabel !== null && editor.isEditable ? (
          <Button
            size="small"
            variant="text"
            onClick={handleEdit}
            data-testid={options.editTestId(kind)}
          >
            {editLabel}
          </Button>
        ) : null}
      </Box>
    </NodeViewWrapper>
  )
}
