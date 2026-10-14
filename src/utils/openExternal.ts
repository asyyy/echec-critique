import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

/** Ouvre une URL dans le navigateur intégré (natif) ou un nouvel onglet (web). */
export async function openExternalUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url })
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
