import { onBeforeUnmount } from 'vue'

interface PressGestureOptions {
  /** Tap simple ; différé de doubleTapMs si un double tap est aussi écouté */
  onTap?: (anchor: HTMLElement) => void
  onDoubleTap?: (anchor: HTMLElement) => void
  onLongPress?: (anchor: HTMLElement) => void
  /** Durée de l'appui long (ms) */
  longPressMs?: number
  /** Délai max entre deux taps (ms) */
  doubleTapMs?: number
  /** Les gestes démarrés sur ces éléments sont ignorés (ex. boutons internes) */
  ignoreSelector?: string
}

const MOVE_TOLERANCE = 10
const DOUBLE_TAP_DISTANCE = 30

/**
 * Double tap + appui long, détectés à la main via Pointer Events
 * (plus fiable que dblclick dans les WebViews mobiles).
 * À binder avec v-on="handlers". Le handler de double tap s'exécute dans le geste
 * utilisateur : on peut y appeler focus() pour ouvrir le clavier mobile.
 */
export function usePressGestures(options: PressGestureOptions) {
  const longPressMs = options.longPressMs ?? 1000
  const doubleTapMs = options.doubleTapMs ?? 300
  const ignoreSelector = options.ignoreSelector ?? 'button'

  let timer: number | undefined
  let tapTimer: number | undefined
  let startX = 0
  let startY = 0
  let tracking = false
  /** Élément portant les handlers (currentTarget n'existe plus dans un setTimeout) */
  let anchor: HTMLElement | null = null
  let longPressed = false
  let lastTapAt = 0
  let lastTapX = 0
  let lastTapY = 0

  function clearTimer() {
    if (timer !== undefined) window.clearTimeout(timer)
    timer = undefined
  }

  function clearTapTimer() {
    if (tapTimer !== undefined) window.clearTimeout(tapTimer)
    tapTimer = undefined
  }

  function pointerdown(event: PointerEvent) {
    if (event.button !== 0) return
    if ((event.target as Element | null)?.closest(ignoreSelector)) return
    tracking = true
    longPressed = false
    anchor = event.currentTarget as HTMLElement
    startX = event.clientX
    startY = event.clientY
    clearTimer()
    if (options.onLongPress) {
      timer = window.setTimeout(() => {
        timer = undefined
        longPressed = true
        lastTapAt = 0
        navigator.vibrate?.(15)
        if (anchor) options.onLongPress?.(anchor)
      }, longPressMs)
    }
  }

  function pointermove(event: PointerEvent) {
    if (!tracking) return
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > MOVE_TOLERANCE) {
      tracking = false
      clearTimer()
    }
  }

  function pointerup(event: PointerEvent) {
    clearTimer()
    if (!tracking || longPressed) {
      tracking = false
      return
    }
    tracking = false
    const el = anchor
    if (!el) return
    const now = Date.now()
    const near =
      Math.hypot(event.clientX - lastTapX, event.clientY - lastTapY) < DOUBLE_TAP_DISTANCE
    if (options.onDoubleTap && now - lastTapAt < doubleTapMs && near) {
      lastTapAt = 0
      clearTapTimer()
      options.onDoubleTap(el)
      return
    }
    lastTapAt = now
    lastTapX = event.clientX
    lastTapY = event.clientY
    if (options.onTap) {
      clearTapTimer()
      if (options.onDoubleTap) {
        tapTimer = window.setTimeout(() => {
          tapTimer = undefined
          options.onTap?.(el)
        }, doubleTapMs)
      } else {
        options.onTap(el)
      }
    }
  }

  function pointercancel() {
    tracking = false
    clearTimer()
  }

  /** Empêche le menu contextuel natif (appui long sur mobile) */
  function contextmenu(event: Event) {
    event.preventDefault()
  }

  onBeforeUnmount(() => {
    clearTimer()
    clearTapTimer()
  })

  return { pointerdown, pointermove, pointerup, pointercancel, contextmenu }
}
