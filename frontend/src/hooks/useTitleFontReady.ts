import { useEffect, useState } from 'react'

function escapeFontFamily(fontFamily: string) {
  return fontFamily.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function getFontSpec(fontSize: number, fontFamily: string) {
  return `normal normal ${Math.max(10, Math.round(fontSize))}px "${escapeFontFamily(fontFamily)}"`
}

function getFontFaceSet() {
  if (typeof document === 'undefined' || !document.fonts) return null
  return document.fonts
}

export async function ensureTitleFontLoaded(fontSize: number, fontFamily: string) {
  const fontFaceSet = getFontFaceSet()
  if (!fontFaceSet) return

  const fontSpec = getFontSpec(fontSize, fontFamily)

  try {
    await fontFaceSet.load(fontSpec)
    await fontFaceSet.ready
  } catch (error) {
    console.warn('Failed to load font:', error)
  }
}

export function useTitleFontReady(fontSize: number, fontFamily: string) {
  const [isReady, setIsReady] = useState(() => {
    const fontFaceSet = getFontFaceSet()
    return !fontFaceSet || fontFaceSet.check(getFontSpec(fontSize, fontFamily))
  })

  useEffect(() => {
    const fontFaceSet = getFontFaceSet()
    if (!fontFaceSet) {
      setIsReady(true)
      return
    }

    const fontSpec = getFontSpec(fontSize, fontFamily)
    const ready = fontFaceSet.check(fontSpec)
    setIsReady(ready)

    if (ready) return

    let cancelled = false

    void (async () => {
      await ensureTitleFontLoaded(fontSize, fontFamily)
      if (!cancelled) setIsReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [fontFamily, fontSize])

  return isReady
}
