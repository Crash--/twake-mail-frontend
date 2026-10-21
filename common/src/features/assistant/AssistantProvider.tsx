import {
  createContext,
  createRef,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject
} from 'react'

export interface AssistantPanelControl {
  isOpen: boolean
  toggle: () => void
  close: () => void
  openerRef: RefObject<HTMLButtonElement | null>
}

// Outside the provider: closed, and nothing opens it
const CLOSED: AssistantPanelControl = {
  isOpen: false,
  toggle: () => undefined,
  close: () => undefined,
  openerRef: createRef()
}

const AssistantContext = createContext<AssistantPanelControl>(CLOSED)

export function AssistantProvider({
  children
}: {
  children: ReactNode
}): ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const openerRef = useRef<HTMLButtonElement | null>(null)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (wasOpenRef.current && !isOpen) openerRef.current?.focus()
    wasOpenRef.current = isOpen
  }, [isOpen])

  const control = useMemo(
    (): AssistantPanelControl => ({
      isOpen,
      toggle: () => {
        setIsOpen(open => !open)
      },
      close: () => {
        setIsOpen(false)
      },
      openerRef
    }),
    [isOpen]
  )
  return <AssistantContext value={control}>{children}</AssistantContext>
}

export function useAssistantPanel(): AssistantPanelControl {
  return useContext(AssistantContext)
}
