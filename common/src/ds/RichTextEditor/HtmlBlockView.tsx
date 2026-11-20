// Upstream to twake-ui: with HtmlBlock (see htmlBlock.ts).
import { Bottom, Top } from '@linagora/twake-icons'
import { Box, Button, IconButton, Tooltip } from '@linagora/twake-mui'
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'

import { Icon } from '@/ds/Icon/Icon'

import type { HtmlBlockOptions } from './htmlBlock'

const MIN_FRAME_HEIGHT = 24

const FIRST_LINE_SX = { display: 'flex', alignItems: 'center', gap: 0.5 }

function serialize(nodes: Node[]): string {
  const container = document.createElement('div')
  container.append(...nodes)
  return container.innerHTML
}

function splitFirstLine(html: string): { first: string; rest: string } | null {
  const template = document.createElement('template')
  template.innerHTML = html
  const nodes = Array.from(template.content.childNodes)
  const index = nodes.findIndex(node => node.nodeName === 'BR')
  if (index === -1) return null
  return {
    first: serialize(nodes.slice(0, index)),
    rest: serialize(nodes.slice(index + 1))
  }
}

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
  const [isFolded, setIsFolded] = useState(false)
  const toggleLabel =
    node.attrs.display === 'inline' ? options.toggleLabel(kind, isFolded) : null
  const isFoldable = toggleLabel !== null
  const lines = useMemo(
    () => (isFoldable ? splitFirstLine(html) : null),
    [isFoldable, html]
  )

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
        {toggleLabel !== null && lines !== null ? (
          // Sanitized by whoever inserted the block (see HtmlBlock)
          <>
            <Box sx={FIRST_LINE_SX}>
              <span dangerouslySetInnerHTML={{ __html: lines.first }} />
              <Tooltip title={toggleLabel}>
                <IconButton
                  size="xsmall"
                  aria-label={toggleLabel}
                  aria-expanded={!isFolded}
                  onClick={() => {
                    setIsFolded(folded => !folded)
                  }}
                  data-testid={options.toggleTestId(kind)}
                >
                  <Icon
                    icon={isFolded ? Bottom : Top}
                    size={16}
                    aria-hidden="true"
                    // A click on the icon must target the button: ProseMirror
                    // keeps clicks on a button, but selects the block (and
                    // takes the focus) on any other element of the node view
                    pointerEvents="none"
                  />
                </IconButton>
              </Tooltip>
            </Box>
            <Box
              hidden={isFolded}
              dangerouslySetInnerHTML={{ __html: lines.rest }}
            />
          </>
        ) : node.attrs.display === 'inline' ? (
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
            data-testid={options.editTestId(kind)}
          >
            {editLabel}
          </Button>
        ) : null}
      </Box>
    </NodeViewWrapper>
  )
}
