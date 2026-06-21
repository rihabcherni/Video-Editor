export type ExportQuality = '480p' | '720p' | '1080p'
export type ExportAspectRatio = 'original' | '16:9' | '9:16' | '1:1' | '4:5' | '5:4' | '4:3' | '3:2'
export type BorderMode = 'inside' | 'outside'

const aspectRatioMap: Record<ExportAspectRatio, { w: number; h: number }> = {
  original: { w: 16, h: 9 },
  '16:9': { w: 16, h: 9 },
  '9:16': { w: 9, h: 16 },
  '1:1': { w: 1, h: 1 },
  '4:5': { w: 4, h: 5 },
  '5:4': { w: 5, h: 4 },
  '4:3': { w: 4, h: 3 },
  '3:2': { w: 3, h: 2 },
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function makeEven(n: number) {
  const next = Math.max(2, Math.round(n))
  return next % 2 === 0 ? next : next - 1
}

export function getRenderedVideoDimensions(params: {
  sourceWidth: number
  sourceHeight: number
  quality: ExportQuality
  aspectRatio: ExportAspectRatio
  borderEnabled: boolean
  borderWidth: number
  borderHeight: number
  borderMode: BorderMode
}) {
  const { sourceWidth, sourceHeight, quality, aspectRatio, borderEnabled, borderWidth, borderHeight, borderMode } = params
  if (!sourceWidth || !sourceHeight) return { width: 0, height: 0 }

  const scaleMap: Record<ExportQuality, number> = { '480p': 854, '720p': 1280, '1080p': 1920 }
  const baseLong = scaleMap[quality]

  let width = sourceWidth
  let height = sourceHeight

  if (!aspectRatio || aspectRatio === 'original') {
    width = baseLong
    height = makeEven((sourceHeight / sourceWidth) * baseLong)
  } else {
    const { w, h } = aspectRatioMap[aspectRatio] || aspectRatioMap['16:9']
    const ratio = w / h
    if (ratio >= 1) {
      width = makeEven(baseLong)
      height = makeEven(baseLong / ratio)
    } else {
      height = makeEven(baseLong)
      width = makeEven(baseLong * ratio)
    }
  }

  if (!borderEnabled) return { width, height }

  const sizeX = clamp(Number(borderWidth || 0), 0, 300)
  const sizeY = clamp(Number(borderHeight || 0), 0, 300)
  if (sizeX <= 0 && sizeY <= 0) return { width, height }

  if (borderMode === 'outside') {
    return {
      width: width + sizeX * 2,
      height: height + sizeY * 2,
    }
  }

  return { width, height }
}

export function getCroppedSourceDimensions(params: {
  sourceWidth: number
  sourceHeight: number
  cropEnabled?: boolean
  crop?: {
    top?: number
    bottom?: number
    left?: number
    right?: number
  }
}) {
  const { sourceWidth, sourceHeight, cropEnabled, crop } = params
  if (!sourceWidth || !sourceHeight) return { width: 0, height: 0 }
  if (!cropEnabled || !crop) return { width: sourceWidth, height: sourceHeight }

  const horizontalKeep = Math.max(0.01, 1 - (crop.left || 0) - (crop.right || 0))
  const verticalKeep = Math.max(0.01, 1 - (crop.top || 0) - (crop.bottom || 0))

  return {
    width: Math.max(2, sourceWidth * horizontalKeep),
    height: Math.max(2, sourceHeight * verticalKeep),
  }
}

export function getContainRect(params: {
  containerWidth: number
  containerHeight: number
  contentWidth: number
  contentHeight: number
}) {
  const { containerWidth, containerHeight, contentWidth, contentHeight } = params
  if (!containerWidth || !containerHeight || !contentWidth || !contentHeight) {
    return { left: 0, top: 0, width: containerWidth, height: containerHeight }
  }

  const contentRatio = contentWidth / contentHeight
  const containerRatio = containerWidth / containerHeight

  let width = containerWidth
  let height = containerHeight

  if (contentRatio > containerRatio) {
    height = width / contentRatio
  } else {
    width = height * contentRatio
  }

  return {
    left: (containerWidth - width) / 2,
    top: (containerHeight - height) / 2,
    width,
    height,
  }
}
