/** Mode debug : onglets / outils de développement uniquement. */
export function isDebugMode(): boolean {
  if (import.meta.env.DEV) return true
  try {
    return new URLSearchParams(window.location.search).has('debug')
  } catch {
    return false
  }
}
