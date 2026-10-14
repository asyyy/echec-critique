import { nextTick } from 'vue'
import type { SearchEntry } from '@/utils/searchIndex'

const HIGHLIGHT_CLASS = 'search-target-highlight'

export async function navigateSearchResult(
  entry: SearchEntry,
  setTab: (tab: SearchEntry['tab']) => void,
): Promise<void> {
  setTab(entry.tab)
  await nextTick()
  await nextTick()

  requestAnimationFrame(async () => {
    const el = document.getElementById(entry.targetId)
    if (!el) return

    const accordionItem = el.closest('.accordion-item')
    const panel = accordionItem?.querySelector('.accordion-panel') as HTMLElement | null
    const trigger = accordionItem?.querySelector('.accordion-trigger') as HTMLButtonElement | null
    if (trigger && panel && getComputedStyle(panel).display === 'none') {
      trigger.click()
      await nextTick()
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'center' })

    el.classList.remove(HIGHLIGHT_CLASS)
    void el.offsetWidth
    el.classList.add(HIGHLIGHT_CLASS)

    window.setTimeout(() => el.classList.remove(HIGHLIGHT_CLASS), 1800)
  })
}
