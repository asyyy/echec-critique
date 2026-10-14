<script setup lang="ts">
import { useTooltip } from '@/composables/useTooltip'

const props = defineProps<{
  title: string
  /** Paragraphes du corps de la bulle */
  lines: string[]
  label?: string
}>()

const { tooltip: pos, toggle } = useTooltip(220)
</script>

<template>
  <button
    type="button"
    class="info-tip-btn"
    :aria-label="props.label ?? props.title"
    :aria-expanded="!!pos"
    @click.stop.prevent="toggle(true, $event.currentTarget as HTMLElement)"
  >
    i
  </button>
  <Teleport to="body">
    <div
      v-if="pos"
      class="info-tip"
      :class="{ above: pos.above }"
      role="tooltip"
      :style="{ top: `${pos.top}px`, left: `${pos.left}px` }"
      @click.stop
    >
      <div class="info-tip-title">{{ props.title }}</div>
      <p v-for="(line, i) in props.lines" :key="i" class="info-tip-body">{{ line }}</p>
    </div>
  </Teleport>
</template>

<style scoped>
.info-tip-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 1.15rem;
  height: 1.15rem;
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--color-border-hover);
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
  font-size: 0.7rem;
  font-weight: 800;
  font-style: italic;
  font-family: Georgia, serif;
  line-height: 1;
  vertical-align: middle;
}

.info-tip {
  position: fixed;
  /* Au-dessus de tout, y compris le panneau Options (z-index 1000) */
  z-index: 1100;
  width: min(280px, calc(100vw - 24px));
  transform: translate(-50%, 0);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-hover);
  border-radius: var(--radius-md);
  padding: 0.65rem 0.75rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.info-tip.above {
  transform: translate(-50%, -100%);
}

.info-tip-title {
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--color-text-primary);
  line-height: 1.2;
}

.info-tip-body {
  margin: 0.4rem 0 0;
  font-size: 0.8rem;
  line-height: 1.35;
  color: var(--color-text-secondary);
}
</style>
