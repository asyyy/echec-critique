<script setup lang="ts">
import { computed, onActivated, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PIXEL_ICONS, type PixelIconDef, type PixelIconName } from '@/components/icons/pixelIcons'

const { t } = useI18n()

interface DraftIcon {
  name: PixelIconName
  pixels: string[]
  palette: Record<string, string>
  selectedColor: string
  /** Empreinte de PIXEL_ICONS au moment du chargement — pour resync HMR */
  sourceFp: string
}

function sourceFingerprint(name: PixelIconName): string {
  const def = PIXEL_ICONS[name]
  return JSON.stringify({ palette: def.palette, pixels: def.pixels })
}

function cloneDef(def: PixelIconDef): Pick<DraftIcon, 'pixels' | 'palette'> {
  return {
    pixels: def.pixels.map((row) => row),
    palette: { ...def.palette },
  }
}

function makeDraft(name: PixelIconName): DraftIcon {
  const cloned = cloneDef(PIXEL_ICONS[name])
  const colors = Object.keys(cloned.palette)
  return {
    name,
    ...cloned,
    selectedColor: colors[0] ?? 'S',
    sourceFp: sourceFingerprint(name),
  }
}

const drafts = reactive<DraftIcon[]>([])

function syncDraftsFromSource() {
  const names = Object.keys(PIXEL_ICONS) as PixelIconName[]
  for (let i = drafts.length - 1; i >= 0; i--) {
    if (!names.includes(drafts[i].name)) {
      drafts.splice(i, 1)
    }
  }
  for (const name of names) {
    const source = PIXEL_ICONS[name]
    const fp = sourceFingerprint(name)
    const existing = drafts.find((d) => d.name === name)
    if (!existing) {
      drafts.push(makeDraft(name))
      continue
    }
    const sizeMismatch =
      existing.pixels.length !== source.pixels.length ||
      (existing.pixels[0]?.length ?? 0) !== (source.pixels[0]?.length ?? 0)
    // Fichier source mis à jour / draft KeepAlive périmé → recharger
    if (existing.sourceFp !== fp || sizeMismatch) {
      const fresh = makeDraft(name)
      existing.pixels = fresh.pixels
      existing.palette = fresh.palette
      existing.sourceFp = fresh.sourceFp
      if (
        existing.selectedColor !== '.' &&
        !Object.keys(existing.palette).includes(existing.selectedColor)
      ) {
        existing.selectedColor = fresh.selectedColor
      }
    }
  }
}

syncDraftsFromSource()
onActivated(syncDraftsFromSource)
onMounted(syncDraftsFromSource)

if (import.meta.hot) {
  import.meta.hot.accept('./icons/pixelIcons.ts', () => {
    syncDraftsFromSource()
  })
}

const previewSize = ref(72)
const statusMessage = ref('')
const isPainting = ref(false)
const paintErase = ref(false)
const newColorHex = ref('#e94560')

const GRID_SIZES = [16, 24, 32, 48, 64] as const
const PALETTE_KEY_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

const colorKeys = (draft: DraftIcon) => Object.keys(draft.palette)

function gridSize(draft: DraftIcon) {
  return draft.pixels[0]?.length ?? 16
}

function emptyRow(size: number) {
  return '.'.repeat(size)
}

function resizeDraft(draft: DraftIcon, size: number) {
  const oldW = gridSize(draft)
  const oldH = draft.pixels.length
  if (oldW === size && oldH === size) return

  const next = Array.from({ length: size }, () => emptyRow(size).split(''))
  const offsetX = Math.floor((size - oldW) / 2)
  const offsetY = Math.floor((size - oldH) / 2)

  for (let y = 0; y < oldH; y++) {
    for (let x = 0; x < oldW; x++) {
      const tx = x + offsetX
      const ty = y + offsetY
      if (tx < 0 || ty < 0 || tx >= size || ty >= size) continue
      next[ty][tx] = draft.pixels[y][x] ?? '.'
    }
  }

  draft.pixels = next.map((row) => row.join(''))
  flash(`${draft.name} : ${size}×${size}`)
}

function setCell(draft: DraftIcon, x: number, y: number, value: string) {
  const row = draft.pixels[y]
  if (!row || x < 0 || x >= row.length) return
  if (row[x] === value) return
  const chars = row.split('')
  chars[x] = value
  draft.pixels[y] = chars.join('')
}

function paint(draft: DraftIcon, x: number, y: number, erase = false) {
  setCell(draft, x, y, erase ? '.' : draft.selectedColor)
}

function startPaint(draft: DraftIcon, x: number, y: number, event: PointerEvent) {
  if (event.button !== 0 && event.button !== 2) return
  isPainting.value = true
  paintErase.value = event.button === 2 || draft.selectedColor === '.'
  paint(draft, x, y, paintErase.value)
}

function continuePaint(draft: DraftIcon, x: number, y: number) {
  if (!isPainting.value) return
  paint(draft, x, y, paintErase.value)
}

function stopPaint() {
  isPainting.value = false
}

onMounted(() => {
  window.addEventListener('pointerup', stopPaint)
  window.addEventListener('pointercancel', stopPaint)
})

onUnmounted(() => {
  window.removeEventListener('pointerup', stopPaint)
  window.removeEventListener('pointercancel', stopPaint)
})

function resetDraft(draft: DraftIcon) {
  const cloned = cloneDef(PIXEL_ICONS[draft.name])
  draft.pixels = cloned.pixels
  draft.palette = cloned.palette
  draft.sourceFp = sourceFingerprint(draft.name)
  const colors = Object.keys(draft.palette)
  if (!colors.includes(draft.selectedColor)) {
    draft.selectedColor = colors[0] ?? 'S'
  }
  flash(`${draft.name} : réinitialisé`)
}

function clearDraft(draft: DraftIcon) {
  const size = gridSize(draft)
  const height = draft.pixels.length
  draft.pixels = Array.from({ length: height }, () => emptyRow(size))
  flash(`${draft.name} : vidé`)
}

function nextPaletteKey(draft: DraftIcon): string | null {
  const used = new Set(Object.keys(draft.palette))
  for (const key of PALETTE_KEY_POOL) {
    if (!used.has(key)) return key
  }
  return null
}

function addColor(draft: DraftIcon) {
  const key = nextPaletteKey(draft)
  if (!key) {
    flash(`${draft.name} : palette pleine`)
    return
  }
  const hex = newColorHex.value
  draft.palette[key] = hex
  draft.selectedColor = key
  flash(`${draft.name} : couleur ${key} ajoutée`)
}

function exportSnippet(draft: DraftIcon) {
  const paletteLines = Object.entries(draft.palette)
    .map(([k, v]) => `      ${k}: '${v}',`)
    .join('\n')
  const pixelLines = draft.pixels.map((row) => `      '${row}',`).join('\n')
  const snippet = `  ${draft.name}: {
    palette: {
${paletteLines}
    },
    pixels: [
${pixelLines}
    ],
  },`

  void navigator.clipboard.writeText(snippet).then(
    () => flash(`${draft.name} : copié dans le presse-papiers`),
    () => flash(snippet),
  )
}

async function saveDraft(draft: DraftIcon) {
  try {
    const res = await fetch('/__api/save-pixel-icon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draft.name,
        palette: draft.palette,
        pixels: draft.pixels,
      }),
    })
    const data = (await res.json()) as { ok?: boolean; error?: string }
    if (!res.ok || !data.ok) {
      flash(`${draft.name} : ${data.error ?? 'échec de la sauvegarde'}`)
      return
    }
    PIXEL_ICONS[draft.name] = {
      ...PIXEL_ICONS[draft.name],
      palette: { ...draft.palette },
      pixels: draft.pixels.map((row) => row),
    }
    draft.sourceFp = sourceFingerprint(draft.name)
    flash(`${draft.name} : enregistré dans pixelIcons.ts`)
  } catch {
    flash(`${draft.name} : Save dispo uniquement en mode dev`)
  }
}

function flash(message: string) {
  statusMessage.value = message
  window.setTimeout(() => {
    if (statusMessage.value === message) statusMessage.value = ''
  }, 2200)
}

function cellFill(draft: DraftIcon, cell: string) {
  if (cell === '.') return 'transparent'
  return draft.palette[cell] ?? '#ff00ff'
}

const hint = computed(() => t('iconsDebug.hint'))
</script>

<template>
  <div class="icons-debug">
    <header class="icons-debug-header">
      <div>
        <h2 class="icons-debug-title">{{ t('iconsDebug.title') }}</h2>
        <p class="icons-debug-hint">{{ hint }}</p>
      </div>
      <label class="preview-size">
        <span>{{ t('iconsDebug.previewSize') }}</span>
        <input v-model.number="previewSize" type="range" min="48" max="128" step="8" />
        <span class="preview-size-value">{{ previewSize }}px</span>
      </label>
    </header>

    <p v-if="statusMessage" class="icons-debug-status" role="status">{{ statusMessage }}</p>

    <div class="icons-debug-grid">
      <article v-for="draft in drafts" :key="draft.name" class="icon-case">
        <header class="icon-case-header">
          <h3 class="icon-case-title">{{ draft.name }}</h3>
          <div class="icon-case-tools">
            <div class="grid-size-toggle" role="group" :aria-label="t('iconsDebug.gridSize')">
              <button
                v-for="size in GRID_SIZES"
                :key="size"
                type="button"
                class="grid-size-btn"
                :class="{ active: gridSize(draft) === size && draft.pixels.length === size }"
                @click="resizeDraft(draft, size)"
              >
                {{ size }}
              </button>
            </div>
            <span class="icon-case-meta">{{ gridSize(draft) }}×{{ draft.pixels.length }}</span>
          </div>
        </header>

        <div
          class="icon-case-preview"
          :style="{ width: `${previewSize}px`, height: `${previewSize}px` }"
        >
          <svg
            class="preview-svg"
            :viewBox="`0 0 ${gridSize(draft)} ${draft.pixels.length}`"
            shape-rendering="crispEdges"
            aria-hidden="true"
          >
            <template v-for="(row, y) in draft.pixels" :key="`p-${y}`">
              <rect
                v-for="(cell, x) in row.split('')"
                v-show="cell !== '.'"
                :key="`p-${x}-${y}`"
                :x="x"
                :y="y"
                width="1"
                height="1"
                :fill="cellFill(draft, cell)"
              />
            </template>
          </svg>
        </div>

        <div class="palette-row" role="listbox" :aria-label="t('iconsDebug.palette')">
          <button
            type="button"
            class="palette-swatch erase"
            :class="{ active: draft.selectedColor === '.' }"
            :title="t('iconsDebug.erase')"
            @click="draft.selectedColor = '.'"
          >
            ·
          </button>
          <button
            v-for="key in colorKeys(draft)"
            :key="key"
            type="button"
            class="palette-swatch"
            :class="{ active: draft.selectedColor === key }"
            :style="{ background: draft.palette[key] }"
            :title="key"
            @click="draft.selectedColor = key"
          >
            {{ key }}
          </button>
          <label class="add-color" :title="t('iconsDebug.addColor')">
            <input v-model="newColorHex" class="add-color-picker" type="color" />
            <button class="add-color-btn" type="button" @click="addColor(draft)">+</button>
          </label>
        </div>

        <div
          class="pixel-grid"
          :class="{ dense: gridSize(draft) > 32 }"
          :style="{
            gridTemplateColumns: `repeat(${gridSize(draft)}, 1fr)`,
            gridTemplateRows: `repeat(${draft.pixels.length}, 1fr)`,
            aspectRatio: `${gridSize(draft)} / ${draft.pixels.length}`,
          }"
          @contextmenu.prevent
          @pointerup="stopPaint"
          @pointercancel="stopPaint"
        >
          <template v-for="(row, y) in draft.pixels" :key="`${draft.name}-row-${y}`">
            <button
              v-for="(cell, x) in row.split('')"
              :key="`${draft.name}-${x}-${y}`"
              type="button"
              class="pixel-cell"
              :class="{ empty: cell === '.' }"
              :style="{ background: cell === '.' ? undefined : cellFill(draft, cell) }"
              @pointerdown.prevent="startPaint(draft, x, y, $event)"
              @pointerenter="continuePaint(draft, x, y)"
              @pointerup="stopPaint"
            />
          </template>
        </div>

        <div class="icon-case-actions">
          <button type="button" class="case-btn" @click="clearDraft(draft)">
            {{ t('iconsDebug.clear') }}
          </button>
          <button type="button" class="case-btn" @click="resetDraft(draft)">
            {{ t('iconsDebug.reset') }}
          </button>
          <button type="button" class="case-btn" @click="exportSnippet(draft)">
            {{ t('iconsDebug.copy') }}
          </button>
          <button type="button" class="case-btn primary" @click="saveDraft(draft)">
            {{ t('iconsDebug.save') }}
          </button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.icons-debug {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.icons-debug-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.75rem;
}

.icons-debug-title {
  margin: 0;
  font-size: 1.1rem;
}

.icons-debug-hint {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  max-width: 40rem;
  line-height: 1.4;
}

.preview-size {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.preview-size-value {
  min-width: 3rem;
  font-variant-numeric: tabular-nums;
}

.icons-debug-status {
  margin: 0;
  padding: 0.45rem 0.65rem;
  border-radius: var(--radius-sm);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  font-size: 0.8rem;
  color: var(--color-success);
}

.icons-debug-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
  gap: 0.85rem;
}

.icon-case {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.75rem;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.icon-case-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.icon-case-tools {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.grid-size-toggle {
  display: flex;
  gap: 0.2rem;
}

.grid-size-btn {
  min-width: 2rem;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  color: var(--color-text-muted);
  font-size: 0.7rem;
  font-weight: 800;
}

.grid-size-btn.active {
  border-color: var(--color-accent);
  color: var(--color-text-primary);
}

.icon-case-title {
  margin: 0;
  font-size: 0.95rem;
  font-family: ui-monospace, monospace;
}

.icon-case-meta {
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

.icon-case-preview {
  align-self: center;
  background:
    linear-gradient(45deg, #2a2a3a 25%, transparent 25%),
    linear-gradient(-45deg, #2a2a3a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2a2a3a 75%),
    linear-gradient(-45deg, transparent 75%, #2a2a3a 75%);
  background-size: 12px 12px;
  background-position:
    0 0,
    0 6px,
    6px -6px,
    -6px 0;
  background-color: #1a1a28;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  image-rendering: pixelated;
}

.preview-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.palette-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.palette-swatch {
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 4px;
  border: 2px solid transparent;
  font-size: 0.65rem;
  font-weight: 800;
  color: #111;
  text-shadow: 0 0 2px #fff;
  padding: 0;
}

.palette-swatch.erase {
  background: repeating-conic-gradient(#444 0% 25%, #222 0% 50%) 50% / 8px 8px;
  color: #eee;
  text-shadow: none;
}

.palette-swatch.active {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 1px var(--color-accent);
}

.add-color {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  margin-left: 0.15rem;
}

.add-color-picker {
  width: 1.6rem;
  height: 1.6rem;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
}

.add-color-btn {
  width: 1.6rem;
  height: 1.6rem;
  padding: 0;
  border-radius: 4px;
  border: 1px solid var(--color-accent);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  font-size: 1rem;
  font-weight: 800;
  line-height: 1;
}

.pixel-grid {
  display: grid;
  width: 100%;
  aspect-ratio: 1;
  border: 1px solid var(--color-border);
  background: #12121c;
  gap: 1px;
  padding: 1px;
  touch-action: none;
  user-select: none;
}

.pixel-grid.dense {
  /* 48 / 64 px : sans espace entre cases, sinon les traits mangent la moitié de la grille */
  gap: 0;
}

.pixel-cell {
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: none;
  border-radius: 0;
  background: #1c1c2a;
  cursor: crosshair;
  touch-action: none;
}

.pixel-cell.empty {
  background: #1c1c2a;
}

.pixel-cell:hover {
  outline: 1px solid var(--color-accent);
  outline-offset: -1px;
  z-index: 1;
}

.icon-case-actions {
  display: flex;
  gap: 0.4rem;
}

.case-btn {
  flex: 1;
  padding: 0.45rem 0.5rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-weight: 700;
}

.case-btn.primary {
  border-color: var(--color-accent);
  color: var(--color-text-primary);
}
</style>
