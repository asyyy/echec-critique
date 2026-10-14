import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/**
 * Bande défilante horizontale (onglets) : molette verticale → défilement horizontal,
 * glisser à la souris, et indicateurs de contenu masqué à gauche / à droite.
 * Au doigt, le défilement natif suffit.
 */
export function useHorizontalScroll(el: Ref<HTMLElement | null>) {
  const canScrollLeft = ref(false)
  const canScrollRight = ref(false)

  let dragStartX = 0
  let dragStartScroll = 0
  let dragging = false
  /** Vrai après un glisser : le clic qui suit ne doit pas sélectionner d'onglet */
  let suppressClick = false

  function update() {
    const node = el.value
    if (!node) return
    canScrollLeft.value = node.scrollLeft > 1
    canScrollRight.value = node.scrollLeft + node.clientWidth < node.scrollWidth - 1
  }

  function onWheel(event: WheelEvent) {
    const node = el.value
    if (!node || node.scrollWidth <= node.clientWidth) return
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
    event.preventDefault()
    node.scrollLeft += event.deltaY
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !el.value) return
    dragging = true
    suppressClick = false
    dragStartX = event.clientX
    dragStartScroll = el.value.scrollLeft
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging || !el.value) return
    const dx = event.clientX - dragStartX
    if (Math.abs(dx) > 5) suppressClick = true
    if (suppressClick) el.value.scrollLeft = dragStartScroll - dx
  }

  function onPointerUp() {
    dragging = false
  }

  function onClickCapture(event: MouseEvent) {
    if (!suppressClick) return
    suppressClick = false
    event.stopPropagation()
    event.preventDefault()
  }

  /** Amène un élément (onglet actif) dans la zone visible, sans toucher au défilement de la page */
  function reveal(child: HTMLElement | null) {
    const node = el.value
    if (!node || !child) return
    const left = child.offsetLeft - node.offsetLeft
    const right = left + child.offsetWidth
    if (left < node.scrollLeft) node.scrollTo({ left, behavior: 'smooth' })
    else if (right > node.scrollLeft + node.clientWidth) {
      node.scrollTo({ left: right - node.clientWidth, behavior: 'smooth' })
    }
  }

  let observer: ResizeObserver | null = null
  onMounted(() => {
    const node = el.value
    if (!node) return
    node.addEventListener('scroll', update, { passive: true })
    node.addEventListener('wheel', onWheel, { passive: false })
    node.addEventListener('pointerdown', onPointerDown)
    node.addEventListener('click', onClickCapture, true)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    observer = new ResizeObserver(update)
    observer.observe(node)
    update()
  })

  onBeforeUnmount(() => {
    const node = el.value
    node?.removeEventListener('scroll', update)
    node?.removeEventListener('wheel', onWheel)
    node?.removeEventListener('pointerdown', onPointerDown)
    node?.removeEventListener('click', onClickCapture, true)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    observer?.disconnect()
  })

  return { canScrollLeft, canScrollRight, update, reveal }
}
