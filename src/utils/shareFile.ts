import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled'

interface ShareTexts {
  title: string
  text: string
}

function isCancel(err: unknown): boolean {
  const e = err as { name?: string; message?: string } | null
  return e?.name === 'AbortError' || /cancel/i.test(e?.message ?? '')
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Partage un fichier texte.
 * - APK (Capacitor) : la WebView Android n'a ni Web Share ni téléchargement par lien,
 *   on écrit le fichier dans le cache puis on ouvre la feuille de partage native.
 * - Navigateur : Web Share avec fichier si possible, sinon téléchargement.
 */
export async function shareTextFile(
  filename: string,
  content: string,
  texts: ShareTexts,
): Promise<ShareOutcome> {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })
    try {
      await Share.share({
        title: texts.title,
        text: texts.text,
        files: [uri],
        dialogTitle: texts.title,
      })
      return 'shared'
    } catch (err) {
      if (isCancel(err)) return 'cancelled'
      throw err
    }
  }

  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean }
  if (typeof nav.share === 'function') {
    const file = new File([content], filename, { type: 'text/plain' })
    try {
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: texts.title, text: texts.text })
        return 'shared'
      }
    } catch (err) {
      if (isCancel(err)) return 'cancelled'
      // Partage refusé par le navigateur : on retombe sur le téléchargement
    }
  }

  download(filename, content)
  return 'downloaded'
}
