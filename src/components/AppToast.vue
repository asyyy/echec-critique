<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
const { toast, dismiss, runUndo } = useToast()
</script>

<template>
  <Transition name="toast">
    <div v-if="toast" :key="toast.id" class="app-toast" role="status" aria-live="polite">
      <span class="toast-message">{{ toast.message }}</span>
      <button v-if="toast.undo" type="button" class="toast-undo" @click="runUndo">
        {{ t('common.undo') }}
      </button>
      <button
        type="button"
        class="toast-close hit-area"
        :aria-label="t('common.close')"
        @click="dismiss"
      >
        ✕
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.app-toast {
  position: fixed;
  z-index: 90;
  left: 50%;
  bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  width: min(560px, calc(100vw - 2rem));
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.6rem 0.55rem 0.9rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-hover);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  font-size: 0.88rem;
}

.toast-message {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toast-undo {
  flex-shrink: 0;
  min-height: 2.4rem;
  padding: 0 0.8rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-accent);
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
}

.toast-undo:active {
  background: color-mix(in srgb, var(--color-accent) 14%, transparent);
}

.toast-close {
  flex-shrink: 0;
  width: 1.6rem;
  height: 1.6rem;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  line-height: 1;
  cursor: pointer;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 0.75rem);
}
</style>
