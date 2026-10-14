import { onBeforeUnmount, onDeactivated, shallowRef } from 'vue'

export interface TooltipPosition {
  top: number
  left: number
  above: boolean
}

/** Une seule bulle ouverte à la fois dans toute l'app */
let closeActive: (() => void) | null = null

function computePosition(anchor: HTMLElement, estimatedHeight: number): TooltipPosition {
  const rect = anchor.getBoundingClientRect()
  const width = Math.min(280, window.innerWidth - 24)
  const centerX = rect.left + rect.width / 2
  const left = Math.min(window.innerWidth - width / 2 - 12, Math.max(width / 2 + 12, centerX))
  const above = rect.bottom + estimatedHeight > window.innerHeight
  return { top: above ? rect.top - 8 : rect.bottom + 8, left, above }
}

/**
 * Bulle d'aide positionnée sous (ou au-dessus de) son ancre.
 * Se ferme au clic/tap ailleurs, au scroll, au redimensionnement, sur Échap
 * et quand le composant est masqué (changement d'onglet via KeepAlive) ou démonté.
 * La bulle doit porter role="tooltip" pour que les clics à l'intérieur ne la ferment pas.
 */
export function useTooltip<T = true>(estimatedHeight = 200) {
  const tooltip = shallowRef<(TooltipPosition & { target: T }) | null>(null)
  let anchorEl: HTMLElement | null = null

  function onPointerDown(event: PointerEvent) {
    const node = event.target as Element | null
    if (!node) return
    // Clic sur l'ancre : laissé au handler du composant (bascule ouvrir/fermer)
    if (anchorEl?.contains(node) || node.closest('[role="tooltip"]')) return
    close()
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') close()
  }

  function listen(on: boolean) {
    const method = on ? 'addEventListener' : 'removeEventListener'
    document[method]('pointerdown', onPointerDown as EventListener, true)
    document[method]('keydown', onKeyDown as EventListener)
    window[method]('scroll', close, true)
    window[method]('resize', close)
  }

  function open(target: T, anchor: HTMLElement) {
    if (closeActive && closeActive !== close) closeActive()
    anchorEl = anchor
    tooltip.value = { target, ...computePosition(anchor, estimatedHeight) }
    if (closeActive !== close) listen(true)
    closeActive = close
  }

  function close() {
    if (!tooltip.value) return
    tooltip.value = null
    anchorEl = null
    listen(false)
    if (closeActive === close) closeActive = null
  }

  /** Ouvre, ou ferme si la même cible est déjà affichée */
  function toggle(
    target: T,
    anchor: HTMLElement,
    same: (a: T, b: T) => boolean = (a, b) => a === b,
  ) {
    if (tooltip.value && same(tooltip.value.target, target)) close()
    else open(target, anchor)
  }

  onDeactivated(close)
  onBeforeUnmount(close)

  return { tooltip, open, close, toggle }
}
