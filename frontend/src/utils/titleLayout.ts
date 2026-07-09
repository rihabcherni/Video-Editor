export interface TitleRect {
  x: number
  y: number
  width: number
  height: number
}

export interface TitleLineLayout {
  text: string
  drawX: number
  baselineY: number
  visualLeft: number
  visualTop: number
  visualWidth: number
  visualHeight: number
  ascent: number
  descent: number
}

export interface TitleRenderLayout {
  wrappedText: string
  lines: TitleLineLayout[]
  textBounds: TitleRect
  backgroundBounds: TitleRect
  frameBounds: TitleRect
  blockWidth: number
  blockHeight: number
  lineHeight: number
}

interface RawLineMetrics {
  advanceWidth: number
  actualLeft: number
  actualRight: number
  actualWidth: number
  ascent: number
  descent: number
  hasVisibleGlyphs: boolean
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function maxFinite(...values: Array<number | undefined>) {
  const finiteValues = values.filter((value): value is number => Number.isFinite(value))
  return finiteValues.length > 0 ? Math.max(...finiteValues) : 0
}

function getCanvasFont(fontSize: number, fontFamily: string) {
  const escapedFontFamily = fontFamily.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `normal normal ${fontSize}px "${escapedFontFamily}"`
}

export function applyTitleCanvasTextStyle(ctx: CanvasRenderingContext2D, fontSize: number, fontFamily: string) {
  ctx.font = getCanvasFont(fontSize, fontFamily)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  const kerningContext = ctx as CanvasRenderingContext2D & { fontKerning?: string }
  if (typeof kerningContext.fontKerning === 'string') {
    kerningContext.fontKerning = 'none'
  }
}

function getTextMeasurer(fontSize: number, fontFamily: string) {
  const approxCharWidth = Math.max(1, fontSize * 0.6)
  const approxAscent = Math.max(1, fontSize * 0.8)
  const approxDescent = Math.max(1, fontSize * 0.2)
  let referenceAscent = approxAscent
  let referenceDescent = approxDescent
  let measureLine = (value: string): RawLineMetrics => {
    const hasVisibleGlyphs = /\S/u.test(value)
    const advanceWidth = value.length > 0 ? value.length * approxCharWidth : 0
    const actualWidth = hasVisibleGlyphs ? advanceWidth : 0

    return {
      advanceWidth,
      actualLeft: 0,
      actualRight: actualWidth,
      actualWidth,
      ascent: hasVisibleGlyphs ? approxAscent : 0,
      descent: hasVisibleGlyphs ? approxDescent : 0,
      hasVisibleGlyphs,
    }
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (ctx) {
      const applyFont = () => {
        applyTitleCanvasTextStyle(ctx, fontSize, fontFamily)
      }

      applyFont()

      const referenceMetrics = ctx.measureText('Hg')
      const fontBoxMetrics = referenceMetrics as TextMetrics & {
        fontBoundingBoxAscent?: number
        fontBoundingBoxDescent?: number
      }
      referenceAscent = maxFinite(
        referenceMetrics.actualBoundingBoxAscent,
        fontBoxMetrics.fontBoundingBoxAscent,
        approxAscent,
      )
      referenceDescent = maxFinite(
        referenceMetrics.actualBoundingBoxDescent,
        fontBoxMetrics.fontBoundingBoxDescent,
        approxDescent,
      )

      measureLine = (value: string) => {
        applyFont()

        const hasVisibleGlyphs = /\S/u.test(value)
        const measured = ctx.measureText(value || ' ')
        const advanceWidth = value.length > 0 ? measured.width : 0
        const actualLeft = hasVisibleGlyphs ? maxFinite(measured.actualBoundingBoxLeft, 0) : 0
        const actualRight = hasVisibleGlyphs ? maxFinite(measured.actualBoundingBoxRight, measured.width, 0) : 0
        const actualWidth = hasVisibleGlyphs ? maxFinite(actualLeft + actualRight, measured.width) : 0

        return {
          advanceWidth,
          actualLeft,
          actualRight,
          actualWidth,
          ascent: hasVisibleGlyphs ? maxFinite(measured.actualBoundingBoxAscent, referenceAscent) : 0,
          descent: hasVisibleGlyphs ? maxFinite(measured.actualBoundingBoxDescent, referenceDescent) : 0,
          hasVisibleGlyphs,
        }
      }
    }
  }

  return {
    approxCharWidth,
    referenceAscent,
    referenceDescent,
    measureLine,
  }
}

function getMaxTextVisualWidth(params: {
  videoWidth: number
  padding: number
  frameWidth: number
}) {
  const { videoWidth, padding, frameWidth } = params
  const contentInset = padding + frameWidth
  return Math.max(1, videoWidth - (contentInset * 2))
}

function getLineVisualWidth(rawLine: RawLineMetrics, borderWidth: number) {
  if (!rawLine.hasVisibleGlyphs) return 0
  return rawLine.actualWidth + (borderWidth * 2)
}

export function getRenderedTitleFontSize(fontSize: number) {
  return Math.max(10, Math.round(fontSize))
}

export function wrapTitleText(
  text: string,
  fontSize: number,
  videoWidth: number,
  fontFamily: string,
  maxVisualWidth = videoWidth,
  borderWidth = 0,
) {
  if (!text.trim() || !videoWidth) return text

  const lines: string[] = []
  const paragraphs = text.split('\n')
  const { measureLine } = getTextMeasurer(fontSize, fontFamily)
  const measureVisualWidth = (value: string) => getLineVisualWidth(measureLine(value), borderWidth)

  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      lines.push('')
      continue
    }

    const tokens = paragraph.match(/\s+|\S+\s*/g) || [paragraph]
    let currentLine = ''

    for (const token of tokens) {
      if (measureVisualWidth(token) > maxVisualWidth) {
        if (currentLine) {
          lines.push(currentLine)
          currentLine = ''
        }

        let segment = ''
        for (const char of token) {
          const nextSegment = `${segment}${char}`
          if (segment && measureVisualWidth(nextSegment) > maxVisualWidth) {
            lines.push(segment)
            segment = char
          } else {
            segment = nextSegment
          }
        }

        if (segment) currentLine = segment
      } else {
        const nextLine = `${currentLine}${token}`
        if (currentLine && measureVisualWidth(nextLine) > maxVisualWidth) {
          lines.push(currentLine)
          currentLine = token
        } else {
          currentLine = nextLine
        }
      }
    }

    if (currentLine) lines.push(currentLine)
  }

  return lines.join('\n')
}

export function clampNormalizedCenter(value: number, containerSize: number, boxSize: number) {
  if (!containerSize || !Number.isFinite(containerSize)) return 0.5
  if (!boxSize || !Number.isFinite(boxSize)) return Math.min(1, Math.max(0, value))
  if (boxSize >= containerSize) return 0.5

  const half = boxSize / 2
  const min = half / containerSize
  const max = 1 - min
  return Math.min(max, Math.max(min, value))
}

export function getTitleRenderLayout(params: {
  text: string
  fontSize: number
  videoWidth: number
  padding: number
  frameWidth: number
  lineSpacing: number
  fontFamily: string
  borderWidth: number
  align: 'left' | 'center' | 'right'
}): TitleRenderLayout | null {
  const {
    text,
    fontSize,
    videoWidth,
    padding,
    frameWidth,
    lineSpacing,
    fontFamily,
    borderWidth,
    align,
  } = params

  if (!text.trim() || !videoWidth) return null

  const safePadding = clamp(padding, 0, 40)
  const safeFrameWidth = clamp(frameWidth, 0, 30)
  const safeBorderWidth = clamp(borderWidth, 0, 20)
  const safeLineSpacing = Math.max(0, lineSpacing)
  const { measureLine, referenceAscent, referenceDescent } = getTextMeasurer(fontSize, fontFamily)
  const maxTextVisualWidth = getMaxTextVisualWidth({
    videoWidth,
    padding: safePadding,
    frameWidth: safeFrameWidth,
  })
  const wrappedText = wrapTitleText(
    text,
    fontSize,
    videoWidth,
    fontFamily,
    maxTextVisualWidth,
    safeBorderWidth,
  )
  const wrappedLines = wrappedText.split('\n')
  const sourceLines = wrappedLines.length > 0 ? wrappedLines : ['']
  const measuredLines = sourceLines.map((line) => {
    const raw = measureLine(line)
    const visualWidth = getLineVisualWidth(raw, safeBorderWidth)
    const visualLeftFromStart = raw.hasVisibleGlyphs
      ? (-raw.actualLeft) - safeBorderWidth
      : 0
    const ascent = raw.hasVisibleGlyphs ? raw.ascent + safeBorderWidth : referenceAscent
    const descent = raw.hasVisibleGlyphs ? raw.descent + safeBorderWidth : referenceDescent

    return {
      text: line,
      raw,
      visualWidth,
      visualLeftFromStart,
      ascent,
      descent,
    }
  })

  const textWidth = Math.max(...measuredLines.map(line => line.visualWidth), 0)
  const lineHeight = referenceAscent + referenceDescent + safeLineSpacing
  const provisionalLines = measuredLines.map((line, index) => {
    const visualLeft = align === 'left'
      ? 0
      : align === 'right'
        ? textWidth - line.visualWidth
        : (textWidth - line.visualWidth) / 2
    const drawX = visualLeft - line.visualLeftFromStart
    const baselineY = referenceAscent + (index * lineHeight)
    const visualTop = baselineY - line.ascent
    const visualHeight = line.ascent + line.descent

    return {
      ...line,
      drawX,
      baselineY,
      visualLeft,
      visualTop,
      visualHeight,
    }
  })

  const minVisualTop = Math.min(...provisionalLines.map(line => line.visualTop))
  const maxVisualBottom = Math.max(...provisionalLines.map(line => line.visualTop + line.visualHeight))
  const textHeight = maxVisualBottom - minVisualTop
  const textBounds: TitleRect = {
    x: safeFrameWidth + safePadding,
    y: safeFrameWidth + safePadding,
    width: textWidth,
    height: textHeight,
  }
  const backgroundBounds: TitleRect = {
    x: safeFrameWidth,
    y: safeFrameWidth,
    width: textWidth + (safePadding * 2),
    height: textHeight + (safePadding * 2),
  }
  const frameBounds: TitleRect = {
    x: 0,
    y: 0,
    width: backgroundBounds.width + (safeFrameWidth * 2),
    height: backgroundBounds.height + (safeFrameWidth * 2),
  }
  return {
    wrappedText,
    lines: provisionalLines.map((line) => ({
      text: line.text,
      drawX: textBounds.x + line.drawX,
      baselineY: textBounds.y + (line.baselineY - minVisualTop),
      visualLeft: textBounds.x + line.visualLeft,
      visualTop: textBounds.y + (line.visualTop - minVisualTop),
      visualWidth: line.visualWidth,
      visualHeight: line.visualHeight,
      ascent: line.ascent,
      descent: line.descent,
    })),
    textBounds,
    backgroundBounds,
    frameBounds,
    blockWidth: frameBounds.width,
    blockHeight: frameBounds.height,
    lineHeight,
  }
}
