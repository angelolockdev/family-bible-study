import { type CSSProperties, type ReactNode, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type PopoverPosition = {
  arrowLeft: number
  left: number
  maxHeight: number
  placement: 'above' | 'below'
  top: number
  width: number
}

type ScripturePopoverProps = {
  children: ReactNode
  label: string
  url: string
  variant?: 'family' | 'watchtower'
}

const VIEWPORT_MARGIN = 12
const POPOVER_GAP = 10
const MAX_POPOVER_WIDTH = 360
const MIN_ARROW_OFFSET = 20

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

export function ScripturePopover({ children, label, url, variant = 'family' }: ScripturePopoverProps) {
  const popoverId = useId()
  const [isPinned, setIsPinned] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [position, setPosition] = useState<PopoverPosition | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLSpanElement>(null)
  const hoverTimerRef = useRef<number | null>(null)
  const isOpen = !isDismissed && (isPinned || isHovered || isFocused)
  const classPrefix = variant === 'watchtower' ? 'watchtower-verse' : 'verse-link'
  const initialWidth = typeof window === 'undefined'
    ? MAX_POPOVER_WIDTH
    : Math.min(MAX_POPOVER_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2)

  const clearHoverTimer = () => {
    if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = null
  }

  const openOnHover = () => {
    clearHoverTimer()
    setIsDismissed(false)
    setIsHovered(true)
  }

  const scheduleHoverClose = () => {
    clearHoverTimer()
    hoverTimerRef.current = window.setTimeout(() => {
      setIsHovered(false)
    }, 120)
  }

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    const popover = popoverRef.current
    if (!trigger || !popover) return

    const triggerRect = trigger.getBoundingClientRect()
    const measuredPopover = popover.getBoundingClientRect()
    const width = Math.min(MAX_POPOVER_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2)
    const height = measuredPopover.height
    const triggerCenter = triggerRect.left + triggerRect.width / 2
    const left = clamp(
      triggerCenter - width / 2,
      VIEWPORT_MARGIN,
      Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN),
    )
    const spaceBelow = window.innerHeight - triggerRect.bottom - POPOVER_GAP - VIEWPORT_MARGIN
    const spaceAbove = triggerRect.top - POPOVER_GAP - VIEWPORT_MARGIN
    const placement = spaceBelow < height && spaceAbove > spaceBelow ? 'above' : 'below'
    const maxHeight = Math.max(120, placement === 'above' ? spaceAbove : spaceBelow)
    const top = placement === 'above'
      ? triggerRect.top - POPOVER_GAP
      : triggerRect.bottom + POPOVER_GAP
    const arrowLeft = clamp(triggerCenter - left, MIN_ARROW_OFFSET, width - MIN_ARROW_OFFSET)

    setPosition((current) => {
      if (
        current
        && current.placement === placement
        && Math.abs(current.arrowLeft - arrowLeft) < 0.5
        && Math.abs(current.left - left) < 0.5
        && Math.abs(current.maxHeight - maxHeight) < 0.5
        && Math.abs(current.top - top) < 0.5
        && Math.abs(current.width - width) < 0.5
      ) return current

      return { arrowLeft, left, maxHeight, placement, top, width }
    })
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null)
      return
    }

    updatePosition()
    const frame = window.requestAnimationFrame(updatePosition)
    return () => window.cancelAnimationFrame(frame)
  }, [isOpen, updatePosition, children])

  useEffect(() => {
    if (!isOpen) return

    const handleViewportChange = () => updatePosition()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(handleViewportChange)
    if (triggerRef.current) observer?.observe(triggerRef.current)
    if (popoverRef.current) observer?.observe(popoverRef.current)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [isOpen, updatePosition])

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target as Node
      const trigger = triggerRef.current
      if (trigger?.contains(target) || popoverRef.current?.contains(target)) return
      setIsPinned(false)
      setIsHovered(false)
      setIsDismissed(true)
      if (trigger && document.activeElement === trigger) trigger.blur()
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setIsPinned(false)
      setIsHovered(false)
      setIsDismissed(true)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
      clearHoverTimer()
    }
  }, [])

  const popover = isOpen ? createPortal(
    <span
      id={popoverId}
      className={`scripture-popover scripture-popover--${position?.placement ?? 'below'} ${classPrefix}__popover`}
      ref={popoverRef}
      role="dialog"
      aria-label={`Andinin-teny ${label}`}
      onMouseEnter={openOnHover}
      onMouseLeave={scheduleHoverClose}
      style={{
        '--scripture-arrow-left': `${position?.arrowLeft ?? MIN_ARROW_OFFSET}px`,
        left: position?.left ?? VIEWPORT_MARGIN,
        maxHeight: position?.maxHeight,
        opacity: position ? 1 : 0,
        top: position?.top ?? VIEWPORT_MARGIN,
        width: position?.width ?? initialWidth,
      } as CSSProperties}
    >
      <strong>{label}</strong>
      <p>{children}</p>
      <a href={url} target="_blank" rel="noreferrer">Vakio ao amin’ny jw.org</a>
    </span>,
    document.body,
  ) : null

  return (
    <span
      className={`${classPrefix} ${isOpen ? 'is-open' : ''}`}
      onMouseEnter={openOnHover}
      onMouseLeave={scheduleHoverClose}
    >
      <button
        type="button"
        className={`${classPrefix}__trigger`}
        ref={triggerRef}
        aria-controls={isOpen ? popoverId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsPinned((value) => {
          setIsDismissed(value)
          return !value
        })}
        onFocus={() => {
          setIsFocused(true)
          setIsDismissed(false)
        }}
        onBlur={() => {
          setIsFocused(false)
          setIsDismissed(false)
        }}
      >
        {label}
      </button>
      {popover}
    </span>
  )
}
