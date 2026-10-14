import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref, type WatchSource } from 'vue'

/**
 * Onglets principaux : si un seul libellé ne tient pas en entier dans son onglet, on masque
 * tous les libellés (icônes seules) pour récupérer la place.
 *
 * La largeur du texte est calculée (canvas, police réellement appliquée) et non lue sur le
 * libellé affiché : le résultat ne dépend pas de l'état affiché / masqué, donc pas d'oscillation.
 */
export function useTabLabelsFit(
  nav: Ref<HTMLElement | null>,
  options: { button: string; label: string; deps: WatchSource[] },
) {
  const hidden = ref(false)
  let context: CanvasRenderingContext2D | null = null

  function measure(text: string, style: CSSStyleDeclaration): number {
    context ??= document.createElement('canvas').getContext('2d')
    if (!context) return 0
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const spacing = parseFloat(style.letterSpacing) || 0
    const shown = style.textTransform === 'uppercase' ? text.toUpperCase() : text
    return context.measureText(shown).width + spacing * shown.length
  }

  /** Contenu ajouté par un thème après le libellé (ex. curseur du thème Terminal) */
  function afterWidth(label: HTMLElement): number {
    const after = getComputedStyle(label, '::after')
    const content = after.content
    if (!content || content === 'none' || content === 'normal') return 0
    const text = content.replace(/^["']|["']$/g, '')
    return measure(text, after) + (parseFloat(after.marginLeft) || 0)
  }

  function update() {
    const root = nav.value
    if (!root) return
    hidden.value = [...root.querySelectorAll<HTMLElement>(options.button)].some((button) => {
      const label = button.querySelector<HTMLElement>(options.label)
      const text = label?.textContent?.trim()
      if (!label || !text) return false
      const b = getComputedStyle(button)
      const l = getComputedStyle(label)
      const available =
        button.clientWidth -
        (parseFloat(b.paddingLeft) || 0) -
        (parseFloat(b.paddingRight) || 0) -
        (parseFloat(l.paddingLeft) || 0) -
        (parseFloat(l.paddingRight) || 0)
      return measure(text, l) + afterWidth(label) > available + 0.5
    })
  }

  const schedule = () => void nextTick(update)

  let observer: ResizeObserver | null = null
  onMounted(() => {
    if (nav.value) {
      observer = new ResizeObserver(schedule)
      observer.observe(nav.value)
    }
    // Les polices arrivent après le premier rendu : on remesure une fois chargées
    document.fonts?.ready.then(schedule)
    document.fonts?.addEventListener('loadingdone', schedule)
    schedule()
  })
  onBeforeUnmount(() => {
    observer?.disconnect()
    document.fonts?.removeEventListener('loadingdone', schedule)
  })

  // Libellés, langue, thème ou police changés : la place nécessaire change aussi
  watch(options.deps, schedule, { flush: 'post' })

  return { hidden }
}
