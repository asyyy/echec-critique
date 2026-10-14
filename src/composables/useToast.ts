import { ref } from 'vue'

/**
 * Message bref en bas d'écran (un seul à la fois), avec une action « Annuler » optionnelle.
 * Remplace les confirmations bloquantes : on supprime tout de suite, on peut revenir en arrière.
 */
export interface ToastState {
  id: number
  message: string
  undo: (() => void) | null
}

const DURATION_MS = 5000

const toast = ref<ToastState | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null
let nextId = 1

function clearTimer() {
  if (timer) clearTimeout(timer)
  timer = null
}

function dismiss() {
  clearTimer()
  toast.value = null
}

function show(message: string, undo: (() => void) | null = null) {
  clearTimer()
  toast.value = { id: nextId++, message, undo }
  timer = setTimeout(dismiss, DURATION_MS)
}

function runUndo() {
  const undo = toast.value?.undo
  dismiss()
  undo?.()
}

export function useToast() {
  return { toast, show, dismiss, runUndo }
}
