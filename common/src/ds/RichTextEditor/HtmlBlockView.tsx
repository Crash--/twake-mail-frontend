// Upstream to twake-ui: with HtmlBlock (see htmlBlock.ts).
import { Box, Button } from '@linagora/twake-mui'
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { useEffect, useRef, useState, type ReactElement } from 'react'

import type { HtmlBlockOptions } from './htmlBlock'

const MIN_FRAME_HEIGHT = 24

/**
 * The frame of a `frame` block, as high as its content. No `allow-scripts`:
 * nothing in it can run; `allow-same-origin` only lets the editor measure
 * it.
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

  const handleLoad = (): void => {
    observerRef.current?.disconnect()
    const body = frameRef.current?.contentDocument?.body
    if (!body) return
    const measure = (): void => {
      setHeight(Math.max(Math.ceil(body.scrollHeight), MIN_FRAME_HEIGHT))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(body)
    observerRef.current = observer
  }

  return (
    <Box
      component="iframe"
      ref={frameRef}
      title={title}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={document}
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
        {node.attrs.display === 'inline' ? (
          <Box
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
            data-testid={`html-block-edit-${kind}`}
          >
            {editLabel}
          </Button>
        ) : null}
      </Box>
    </NodeViewWrapper>
  )
}
