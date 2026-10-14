<template>
  <svg
    class="pixel-art-icon"
    :width="size"
    :height="size"
    :viewBox="`0 0 ${gridWidth} ${gridHeight}`"
    xmlns="http://www.w3.org/2000/svg"
    shape-rendering="crispEdges"
    aria-hidden="true"
  >
    <template v-if="hasLayers">
      <g v-for="(layer, li) in def.layers" :key="li" :class="layer.className">
        <template v-for="(row, y) in layer.pixels" :key="`${li}-${y}`">
          <template v-for="(cell, x) in row.split('')" :key="`${li}-${x}-${y}`">
            <rect
              v-if="cell !== '.'"
              :x="x"
              :y="y"
              width="1"
              height="1"
              :fill="layer.palette[cell]"
            />
          </template>
        </template>
      </g>
    </template>
    <template v-else>
      <template v-for="(row, y) in def.pixels" :key="y">
        <template v-for="(cell, x) in row.split('')" :key="`${x}-${y}`">
          <rect v-if="cell !== '.'" :x="x" :y="y" width="1" height="1" :fill="def.palette[cell]" />
        </template>
      </template>
    </template>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PIXEL_ICONS, type PixelIconName } from './pixelIcons'

const props = withDefaults(
  defineProps<{
    name: PixelIconName
    size?: number
  }>(),
  { size: 28 },
)

const def = computed(() => PIXEL_ICONS[props.name])
const hasLayers = computed(() => (def.value.layers?.length ?? 0) > 0)
const source = computed(() => def.value.layers?.[0]?.pixels ?? def.value.pixels)
const gridWidth = computed(() => source.value[0]?.length ?? 16)
/** Grille rectangulaire possible (logo + titre) */
const gridHeight = computed(() => source.value.length || gridWidth.value)
</script>

<style scoped>
.pixel-art-icon {
  display: block;
  flex-shrink: 0;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
</style>
