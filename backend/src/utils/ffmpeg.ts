import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'

const outputDir = path.join(process.cwd(), 'outputs')
const finalOutputDir = path.join(process.cwd(), 'final-outputs')
const tempDir = path.join(process.cwd(), 'temp')

function resolveExistingPath(...relativeCandidates: string[]) {
  for (const relativePath of relativeCandidates) {
    const absolutePath = path.join(process.cwd(), relativePath)
    if (fs.existsSync(absolutePath)) return absolutePath
  }
  return path.join(process.cwd(), relativeCandidates[0] || '')
}

const fontsDir = resolveExistingPath('fonts', 'backend/fonts')

export interface CutOptions {
  inputPath: string
  startTime: number
  endTime: number
}

export interface SegmentDefinition {
  startTime: number
  endTime: number
  label?: string
}

export interface MergeVideosOptions {
  inputPaths: string[]
}

export interface MergeSegmentsOptions {
  inputPath: string
  segments: SegmentDefinition[]
}

export interface AudioOptions {
  inputPath: string
  audioPath: string
  replaceOriginal?: boolean
}

export interface SubtitleOptions {
  inputPath: string
  subtitlePath: string
  style?: SubtitleStyle
}

export interface ExportOptions {
  inputPath: string
  quality?: '480p' | '720p' | '1080p'
  aspectRatio?: 'original' | '16:9' | '9:16' | '1:1' | '4:5' | '5:4' | '4:3' | '3:2'
  outputName?: string
  audioPath?: string
  subtitlePath?: string
  subtitleStyle?: SubtitleStyle
  titleStyle?: TitleStyle
  borderStyle?: BorderStyle
  logoPath?: string
  logoSize?: number
  logoX?: number
  logoY?: number
  outputDir?: string
  startTime?: number
  endTime?: number
  replaceOriginal?: boolean
  audioStartTime?: number
  audioEndTime?: number
  audioOffset?: number
  crop?: CropSettings
}

export interface SubtitleStyle {
  size?: number
  color?: string
  backgroundColor?: string
}

export type TitlePosition =
  | 'top-left' | 'top' | 'top-right'
  | 'middle-left' | 'middle' | 'middle-right'
  | 'bottom-left' | 'bottom' | 'bottom-right'

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
  visualLeft?: number
  visualTop?: number
  visualWidth?: number
  visualHeight?: number
  ascent?: number
  descent?: number
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

export interface TitleStyle {
  text?: string
  font?: string
  size?: number
  color?: string
  bgColor?: string
  borderColor?: string
  borderWidth?: number
  frameColor?: string
  frameWidth?: number
  padding?: number
  lineSpacing?: number
  align?: 'left' | 'center' | 'right'
  position?: TitlePosition
  frameMode?: 'inside' | 'outside'
  x?: number
  y?: number
  layout?: TitleRenderLayout
}

export interface BorderStyle {
  enabled?: boolean
  sizeX?: number
  sizeY?: number
  color?: string
  mode?: 'inside' | 'outside'
}

export interface CropSettings {
  top?: number
  bottom?: number
  left?: number
  right?: number
}

const aspectRatioMap: Record<NonNullable<ExportOptions['aspectRatio']>, { w: number; h: number }> = {
  original: { w: 16, h: 9 },
  '16:9': { w: 16, h: 9 },
  '9:16': { w: 9, h: 16 },
  '1:1': { w: 1, h: 1 },
  '4:5': { w: 4, h: 5 },
  '5:4': { w: 5, h: 4 },
  '4:3': { w: 4, h: 3 },
  '3:2': { w: 3, h: 2 },
}

function makeEven(n: number) {
  const next = Math.max(2, Math.round(n))
  return next % 2 === 0 ? next : next - 1
}

function sanitizeBasename(name: string) {
  const cleaned = name
    .replace(/\.[^/.]+$/, '')
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '_')
  return cleaned.slice(0, 80)
}

function normalizeFontName(name: string) {
  return name.toLowerCase().replace(/[\s_\-]+/g, '')
}

function resolveFontFile(fontName?: string) {
  if (!fontName) return null
  try {
    const target = normalizeFontName(fontName)
    const entries = fs.readdirSync(fontsDir)
    for (const file of entries) {
      const ext = path.extname(file).toLowerCase()
      if (ext !== '.ttf' && ext !== '.otf') continue
      const base = normalizeFontName(path.basename(file, ext))
      if (base === target) return path.join(fontsDir, file)
    }
  } catch {
  }
  return null
}

function escapeFontFile(p: string) {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
}

function buildScaleFilter(quality: NonNullable<ExportOptions['quality']>, aspectRatio?: ExportOptions['aspectRatio']) {
  const scaleMap = { '480p': 854, '720p': 1280, '1080p': 1920 }
  const baseLong = scaleMap[quality]
  if (!aspectRatio || aspectRatio === 'original') {
    return `scale=${baseLong}:-2`
  }

  const { w, h } = aspectRatioMap[aspectRatio] || aspectRatioMap['16:9']
  const ratio = w / h
  let targetWidth = baseLong
  let targetHeight = baseLong
  if (ratio >= 1) {
    targetWidth = makeEven(baseLong)
    targetHeight = makeEven(baseLong / ratio)
  } else {
    targetHeight = makeEven(baseLong)
    targetWidth = makeEven(baseLong * ratio)
  }

  return `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight}`
}

function toAssColor(hex?: string) {
  if (!hex) return '&Hffffff'
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return '&Hffffff'
  const r = clean.slice(0, 2)
  const g = clean.slice(2, 4)
  const b = clean.slice(4, 6)
  return `&H${b}${g}${r}`
}

function buildSubtitleStyle(style?: SubtitleStyle) {
  const defaultSize = Number(process.env.SUBTITLE_DEFAULT_SIZE || 22)
  const defaultColor = process.env.SUBTITLE_DEFAULT_COLOR || '#ffffff'
  const defaultBackgroundColor = process.env.SUBTITLE_DEFAULT_BG || '#000000'

  const size = style?.size ?? defaultSize
  const color = toAssColor(style?.color || defaultColor)
  const backgroundColor = toAssColor(style?.backgroundColor || defaultBackgroundColor)
  return `FontName=Arial,FontSize=${size},PrimaryColour=${color},OutlineColour=${backgroundColor},BackColour=${backgroundColor},BorderStyle=3,Outline=1,Shadow=0,Alignment=2,MarginL=20,MarginR=20,MarginV=24`
}

function escapeDrawtext(text: string) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
}

function buildTitleDrawtext(style?: TitleStyle) {
  const text = (style?.text || '').trim()
  if (!text) return null

  const layout = style?.layout
  if (!layout) return null

  const font = style?.font || 'Arial'
  const fontFile = resolveFontFile(font)
  let size: number
  if (font === 'Arial') {
    size = clamp(Number(style?.size ?? 42) - 4, 10, 200)
  } else {
    size = clamp(Number(style?.size ?? 42), 10, 200)
  }

  const color = style?.color || '#ffffff'
  const bgColor = style?.bgColor || '#000000'
  const borderColor = style?.borderColor || '#000000'
  const borderWidth = clamp(Number(style?.borderWidth ?? 0), 0, 20)
  const frameColor = style?.frameColor || '#000000'
  const frameWidth = clamp(Number(style?.frameWidth ?? 0), 0, 30)
  const position = style?.position || 'top'
  const margin = Number(process.env.TITLE_MARGIN || 36)
  const blockWidth = Number.isFinite(layout.blockWidth) ? Math.max(1, Number(layout.blockWidth)) : 0
  const blockHeight = Number.isFinite(layout.blockHeight) ? Math.max(1, Number(layout.blockHeight)) : 0
  const backgroundBounds = layout.backgroundBounds
  const frameBounds = layout.frameBounds
  const lines = Array.isArray(layout.lines)
    ? layout.lines.filter((line) => (
      typeof line?.text === 'string'
      && Number.isFinite(line?.drawX)
      && Number.isFinite(line?.baselineY)
    ))
    : []

  if (
    !blockWidth
    || !blockHeight
    || !backgroundBounds
    || !frameBounds
    || !Number.isFinite(backgroundBounds.x)
    || !Number.isFinite(backgroundBounds.y)
    || !Number.isFinite(backgroundBounds.width)
    || !Number.isFinite(backgroundBounds.height)
    || !Number.isFinite(frameBounds.x)
    || !Number.isFinite(frameBounds.y)
    || !Number.isFinite(frameBounds.width)
    || !Number.isFinite(frameBounds.height)
    || lines.length === 0
  ) {
    return null
  }

  const safeFont = font.includes(' ') ? `'${font.replace(/'/g, "\\'")}'` : font
  const fontArg = fontFile ? `fontfile='${escapeFontFile(fontFile)}'` : `font=${safeFont}`
  const offsetExpr = (baseExpr: string, offset: number) => {
    if (!offset) return baseExpr
    return `(${baseExpr}+${offset})`
  }

  const resolveBlockLayoutPosition = (widthVar: string, heightVar: string) => {
    const regionLeft = 0
    const regionTop = 0
    const regionWidth = widthVar
    const regionHeight = heightVar
    const minLayoutX = 0
    const minLayoutY = 0
    const maxLayoutX = maxExpr(`${widthVar}-${blockWidth}`, 0)
    const maxLayoutY = maxExpr(`${heightVar}-${blockHeight}`, 0)
    const positionMap: Record<TitlePosition, { x: string; y: string }> = {
      'top-left': {
        x: `${regionLeft + margin}`,
        y: `${regionTop + margin}`,
      },
      'top': {
        x: `(${regionLeft}+(${regionWidth}-${blockWidth})/2)`,
        y: `${regionTop + margin}`,
      },
      'top-right': {
        x: `(${regionLeft}+${regionWidth}-${blockWidth}-${margin})`,
        y: `${regionTop + margin}`,
      },
      'middle-left': {
        x: `${regionLeft + margin}`,
        y: `(${regionTop}+(${regionHeight}-${blockHeight})/2)`,
      },
      'middle': {
        x: `(${regionLeft}+(${regionWidth}-${blockWidth})/2)`,
        y: `(${regionTop}+(${regionHeight}-${blockHeight})/2)`,
      },
      'middle-right': {
        x: `(${regionLeft}+${regionWidth}-${blockWidth}-${margin})`,
        y: `(${regionTop}+(${regionHeight}-${blockHeight})/2)`,
      },
      'bottom-left': {
        x: `${regionLeft + margin}`,
        y: `(${regionTop}+${regionHeight}-${blockHeight}-${margin})`,
      },
      'bottom': {
        x: `(${regionLeft}+(${regionWidth}-${blockWidth})/2)`,
        y: `(${regionTop}+${regionHeight}-${blockHeight}-${margin})`,
      },
      'bottom-right': {
        x: `(${regionLeft}+${regionWidth}-${blockWidth}-${margin})`,
        y: `(${regionTop}+${regionHeight}-${blockHeight}-${margin})`,
      },
    }

    if (typeof style?.x === 'number' && typeof style?.y === 'number') {
      const safeX = clamp(style.x, 0, 1)
      const safeY = clamp(style.y, 0, 1)
      const xBase = `(${regionLeft}+${safeX}*${regionWidth})`
      const yBase = `(${regionTop}+${safeY}*${regionHeight})`

      return {
        x: clampExpr(`(${xBase}-${blockWidth}/2)`, minLayoutX, maxLayoutX),
        y: clampExpr(`(${yBase}-${blockHeight}/2)`, minLayoutY, maxLayoutY),
      }
    }

    const { x, y } = positionMap[position]
    return {
      x: clampExpr(x, minLayoutX, maxLayoutX),
      y: clampExpr(y, minLayoutY, maxLayoutY),
    }
  }

  const buildBlockFilters = () => {
    const boxLayout = resolveBlockLayoutPosition('iw', 'ih')
    const textLayout = resolveBlockLayoutPosition('w', 'h')
    const filters: string[] = []
    let addPadding: number = 0
    if (font === 'Arial') {
      addPadding = 0.40 * size;
    } else {
      addPadding = 0.20 * size;
    }
    if (frameWidth > 0) {
      filters.push(
        `drawbox=x=${offsetExpr(boxLayout.x, Number(frameBounds.x) - addPadding / 2)}:y=${offsetExpr(boxLayout.y, Number(frameBounds.y))}:w=${Math.max(1, Number(frameBounds.width)) + addPadding}:h=${Math.max(1, Number(frameBounds.height))}:color=${frameColor}:t=fill`,
      )
    }

    filters.push(
      `drawbox=x=${offsetExpr(boxLayout.x, Number(backgroundBounds.x) - addPadding / 2)}:y=${offsetExpr(boxLayout.y, Number(backgroundBounds.y))}:w=${Math.max(1, Number(backgroundBounds.width)) + addPadding}:h=${Math.max(1, Number(backgroundBounds.height))}:color=${bgColor}:t=fill`,
    )

    lines.forEach((line) => {
      if (!line.text.trim()) return
      const textX = Number.isFinite(line.visualLeft)
        ? Number(line.visualLeft)
        : Number(line.drawX)

      const textY = Number.isFinite(line.visualTop)
        ? Number(line.visualTop)
        : Number.isFinite(line.ascent)
          ? Number(line.baselineY) - Number(line.ascent)
          : Number(line.baselineY)
      const bgLeft = Number(backgroundBounds.x)
      const bgTop = Number(backgroundBounds.y)
      const bgRight = bgLeft + Number(backgroundBounds.width)
      const bgBottom = bgTop + Number(backgroundBounds.height)

      const safeTextX = Math.max(bgLeft, Math.min(textX, bgRight - 1)) - addPadding
      const safeTextY = Math.max(bgTop, Math.min(textY, bgBottom - 1)) + 0.40 * size

      filters.push(
        `drawtext=text='${escapeDrawtext(line.text)}':${fontArg}:fontsize=${size}:fontcolor=${color}` +
        `:x=${offsetExpr(textLayout.x, safeTextX)}` +
        `:y=${offsetExpr(textLayout.y, safeTextY)}` +
        `:borderw=${borderWidth}:bordercolor=${borderColor}:expansion=none`,
      )
    })

    return filters.join(',')
  }
  return buildBlockFilters()
}

function buildBorderFilter(style?: BorderStyle) {
  if (!style?.enabled) return null
  const sizeX = clamp(Number(style.sizeX ?? 0), 0, 300)
  const sizeY = clamp(Number(style.sizeY ?? 0), 0, 300)
  if (sizeX <= 0 && sizeY <= 0) return null
  const color = style.color || '#ffffff'
  const mode = style.mode || 'inside'
  if (mode === 'outside') {
    return `pad=iw+${sizeX * 2}:ih+${sizeY * 2}:${sizeX}:${sizeY}:color=${color}`
  }
  const sx = sizeX
  const sy = sizeY
  const safeX = `min(${sx}\\,max(iw/2-2\\,0))`
  const safeY = `min(${sy}\\,max(ih/2-2\\,0))`
  return `crop=iw-2*${safeX}:ih-2*${safeY}:${safeX}:${safeY},pad=iw+${sx * 2}:ih+${sy * 2}:${sx}:${sy}:color=${color}`
}

function buildCropFilter(crop?: CropSettings) {
  if (!crop) return null

  const top = clamp(Number(crop.top ?? 0), 0, 0.45)
  const bottom = clamp(Number(crop.bottom ?? 0), 0, 0.45)
  const left = clamp(Number(crop.left ?? 0), 0, 0.45)
  const right = clamp(Number(crop.right ?? 0), 0, 0.45)
  const horizontalKeep = 1 - left - right
  const verticalKeep = 1 - top - bottom

  if (horizontalKeep <= 0.01 || verticalKeep <= 0.01) {
    throw new Error('Invalid crop values. The remaining visible area must stay positive.')
  }

  if (top <= 0 && bottom <= 0 && left <= 0 && right <= 0) return null

  const widthExpr = `max(2\\,floor(iw*${horizontalKeep}/2)*2)`
  const heightExpr = `max(2\\,floor(ih*${verticalKeep}/2)*2)`
  const xExpr = `min(iw-${widthExpr}\\,floor(iw*${left}))`
  const yExpr = `min(ih-${heightExpr}\\,floor(ih*${top}))`

  return `crop=${widthExpr}:${heightExpr}:${xExpr}:${yExpr}`
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function clampExpr(expr: string, min: string | number, max: string | number) {
  return `min(${max}\\,max(${min}\\,${expr}))`
}

function maxExpr(left: string | number, right: string | number) {
  return `max(${left}\\,${right})`
}

function buildLogoOverlayFilters(params: {
  logoInputIndex: number
  baseLabel: string
  size?: number
  x?: number
  y?: number
  isGif?: boolean
  estimatedVideoWidth: number
}) {
  const sizePct = clamp(params.size ?? 15, 5, 60)
  const targetW = Math.max(1, Math.round((params.estimatedVideoWidth * sizePct) / 100))

  const logoIn = `[${params.logoInputIndex}:v]`
  const x = `((${clamp(params.x ?? 0.9, 0, 1)}*main_w)-(overlay_w/2))`
  const y = `((${clamp(params.y ?? 0.1, 0, 1)}*main_h)-(overlay_h/2))`

  const shortestOpt = params.isGif ? ':shortest=1' : ''

  return [
    `${logoIn}format=rgba,scale=${targetW}:-1[logo_s]`,
    `[${params.baseLabel}][logo_s]overlay=${x}:${y}${shortestOpt}[vout]`,
  ]
}

export function getVideoMeta(inputPath: string): Promise<ffmpeg.FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) {
        if ((err as any).code === 'ENOENT') {
          reject(new Error('ffprobe not found on system. Please install ffmpeg or use docker-compose.'))
        } else {
          reject(err)
        }
      }
      else resolve(data)
    })
  })
}

export function cutVideo({ inputPath, startTime, endTime }: CutOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const outFile = path.join(outputDir, `cut_${uuidv4()}.mp4`)
    const duration = endTime - startTime

    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions(['-avoid_negative_ts', 'make_zero'])
      .output(outFile)
      .on('end', () => resolve(outFile))
      .on('error', reject)
      .run()
  })
}

export async function splitVideo(inputPath: string, segments: SegmentDefinition[]): Promise<string[]> {
  const outputs: string[] = []
  for (const segment of segments) {
    const outPath = await cutVideo({
      inputPath,
      startTime: segment.startTime,
      endTime: segment.endTime,
    })
    outputs.push(outPath)
  }
  return outputs
}

export function mergeVideos({ inputPaths }: MergeVideosOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!inputPaths.length) {
      reject(new Error('No segments provided for merge'))
      return
    }

    const listFile = path.join(tempDir, `concat_${uuidv4()}.txt`)
    const outFile = path.join(outputDir, `merge_${uuidv4()}.mp4`)
    const fileList = inputPaths
      .map(filePath => `file '${filePath.replace(/'/g, "'\\''").replace(/\\/g, '/')}'`)
      .join('\n')

    fs.writeFileSync(listFile, fileList, 'utf8')

    ffmpeg()
      .input(listFile)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c copy'])
      .output(outFile)
      .on('end', () => {
        try {
          fs.unlinkSync(listFile)
        } catch {
        }
        resolve(outFile)
      })
      .on('error', (err) => {
        try {
          fs.unlinkSync(listFile)
        } catch {
        }
        reject(err)
      })
      .run()
  })
}

export async function mergeSegments({ inputPath, segments }: MergeSegmentsOptions): Promise<string> {
  if (!segments.length) {
    throw new Error('No segments provided for merge')
  }
  const outputs = await splitVideo(inputPath, segments)
  return mergeVideos({ inputPaths: outputs })
}

export function mergeAudio({ inputPath, audioPath, replaceOriginal = false }: AudioOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const outFile = path.join(outputDir, `audio_${uuidv4()}.mp4`)

    const cmd = ffmpeg(inputPath).input(audioPath)

    if (replaceOriginal) {
      cmd
        .outputOptions([
          '-map 0:v:0',
          '-map 1:a:0',
          '-c:v copy',
          '-c:a aac',
          '-shortest',
        ])
    } else {
      cmd.complexFilter([
        `[0:a]anull[a0]`,
        `[1:a]anull[a1]`,
        `[a0][a1]amix=inputs=2:duration=first[aout]`,
      ], 'aout')
        .outputOptions(['-map 0:v', '-c:v copy', '-c:a aac'])
    }

    cmd
      .output(outFile)
      .on('end', () => resolve(outFile))
      .on('error', reject)
      .run()
  })
}

export function burnSubtitles({ inputPath, subtitlePath, style }: SubtitleOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const outFile = path.join(outputDir, `sub_${uuidv4()}.mp4`)
    const escapedSrt = subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:')
    const forceStyle = buildSubtitleStyle(style)

    ffmpeg(inputPath)
      .videoFilter(`subtitles='${escapedSrt}':force_style='${forceStyle}'`)
      .videoCodec('libx264')
      .audioCodec('copy')
      .output(outFile)
      .on('end', () => resolve(outFile))
      .on('error', reject)
      .run()
  })
}

export function exportVideo(options: ExportOptions, onProgress?: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const outDir = options.outputDir || outputDir
    const baseName = options.outputName ? sanitizeBasename(options.outputName) : ''
    const initialName = baseName ? `${baseName}.mp4` : `export_${uuidv4()}.mp4`
    let outFile = path.join(outDir, initialName)
    if (fs.existsSync(outFile)) {
      const fallback = baseName ? `${baseName}_${uuidv4()}.mp4` : `export_${uuidv4()}.mp4`
      outFile = path.join(outDir, fallback)
    }
    const { inputPath, quality = '720p', aspectRatio, startTime, endTime, audioPath, subtitlePath, replaceOriginal, audioStartTime, audioEndTime,
      crop, titleStyle, borderStyle, logoPath, logoSize } = options
    const scaleFilter = buildScaleFilter(quality, aspectRatio)
    const cropFilter = buildCropFilter(crop)

    let cmd = ffmpeg(inputPath)

    if (startTime !== undefined && endTime !== undefined) {
      cmd = cmd.setStartTime(startTime).setDuration(endTime - startTime)
    }

    const crf = process.env.FFMPEG_CRF || '23'
    const preset = process.env.FFMPEG_PRESET || 'fast'
    cmd.videoCodec('libx264')
    cmd.addOption('-crf', crf)
    cmd.addOption('-preset', preset)

    const hasAudio = !!(audioPath && fs.existsSync(audioPath))
    const hasLogo = !!(logoPath && fs.existsSync(logoPath))

    const scaleMap = { '480p': 854, '720p': 1280, '1080p': 1920 }
    const baseLong = scaleMap[quality] || 1280
    let estimatedVideoWidth = baseLong
    if (aspectRatio && aspectRatio !== 'original') {
      const ar = aspectRatioMap[aspectRatio] || aspectRatioMap['16:9']
      const ratio = ar.w / ar.h
      if (ratio < 1) {
        estimatedVideoWidth = makeEven(baseLong * ratio)
      } else {
        estimatedVideoWidth = makeEven(baseLong)
      }
    }

    if (borderStyle?.enabled && borderStyle.mode === 'outside') {
      const sizeX = clamp(Number(borderStyle.sizeX ?? 0), 0, 300)
      estimatedVideoWidth += sizeX * 2
    }

    const titleFilter = buildTitleDrawtext(titleStyle)
    const borderFilter = buildBorderFilter(borderStyle)

    const isGif = hasLogo && logoPath!.toLowerCase().endsWith('.gif')
    if (hasAudio) cmd.input(audioPath!)
    if (hasLogo) {
      cmd.input(logoPath!)
      if (isGif) {
        cmd.inputOptions(['-ignore_loop 0'])
      }
    }

    const subtitleFilter = subtitlePath && fs.existsSync(subtitlePath)
      ? (() => {
        const escapedSrt = subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:')
        const forceStyle = buildSubtitleStyle(options.subtitleStyle)
        return `,subtitles='${escapedSrt}':force_style='${forceStyle}'`
      })()
      : ''

    if (hasAudio || hasLogo) {
      const filters: string[] = []
      const baseLabel = hasLogo ? 'vbase' : 'vout'
      const vfParts: string[] = []
      if (cropFilter) vfParts.push(cropFilter)
      vfParts.push(scaleFilter)
      if (borderFilter) vfParts.push(borderFilter)
      if (subtitleFilter) vfParts.push(subtitleFilter.slice(1))
      if (titleFilter) vfParts.push(titleFilter)
      filters.push(`[0:v]${vfParts.join(',')}[${baseLabel}]`)

      if (hasLogo) {
        const logoInputIndex = hasAudio ? 2 : 1
        filters.push(...buildLogoOverlayFilters({
          logoInputIndex,
          baseLabel,
          size: logoSize,
          x: options.logoX,
          y: options.logoY,
          isGif,
          estimatedVideoWidth,
        }))
      }

      if (hasAudio) {
        const videoStart = options.startTime || 0
        const audioOff = options.audioOffset || 0
        const relativeOffset = audioOff - videoStart

        const offsetMs = Math.round(Math.max(0, relativeOffset) * 1000)
        const extraAudioTrim = relativeOffset < 0 ? Math.abs(relativeOffset) : 0
        const finalAudioStart = (audioStartTime || 0) + extraAudioTrim
        const hasEffectiveAudioTrim = finalAudioStart > 0 || audioEndTime !== undefined

        const effectiveAudioTrimFilter = hasEffectiveAudioTrim
          ? `atrim=start=${finalAudioStart}${audioEndTime !== undefined ? `:end=${audioEndTime}` : ''},asetpts=PTS-STARTPTS`
          : null
        const audioFilters: string[] = []
        if (offsetMs > 0) audioFilters.push(`adelay=${offsetMs}|${offsetMs}`)
        if (effectiveAudioTrimFilter) audioFilters.push(effectiveAudioTrimFilter)
        const audioChain = audioFilters.join(',') || 'anull'

        if (replaceOriginal) {
          filters.push(`[1:a]${audioChain}[aout]`)
          cmd.outputOptions(['-map [vout]', '-map [aout]', '-c:a aac'])
        } else {
          filters.push(`[0:a]anull[a0]`)
          filters.push(`[1:a]${audioChain}[a1]`)
          filters.push(`[a0][a1]amix=inputs=2:duration=first[aout]`)
          cmd.outputOptions(['-map [vout]', '-map [aout]', '-c:a aac'])
        }
      } else {
        cmd.outputOptions(['-map [vout]', '-map 0:a?', '-c:a aac'])
      }

      cmd.complexFilter(filters)
    } else {
      const filters: string[] = []
      if (cropFilter) filters.push(cropFilter)
      filters.push(scaleFilter)
      if (borderFilter) filters.push(borderFilter)
      if (subtitleFilter) filters.push(subtitleFilter.slice(1))
      if (titleFilter) filters.push(titleFilter)
      cmd.videoFilter(filters)
      cmd.audioCodec('aac')
    }

    cmd
      .output(outFile)
      .on('progress', p => onProgress?.(Math.round(p.percent || 0)))
      .on('end', () => resolve(outFile))
      .on('error', reject)
      .run()
  })
}

export function generateThumbnail(inputPath: string, atSecond = 1): Promise<string> {
  return new Promise((resolve, reject) => {
    const outFile = path.join(finalOutputDir, `thumb_${uuidv4()}.jpg`)
    const width = Math.max(160, Number(process.env.THUMBNAIL_WIDTH || 640))
    const quality = clamp(Number(process.env.THUMBNAIL_QUALITY || 3), 2, 31)
    const seekSecond = Math.max(0, atSecond)

    ffmpeg(inputPath)
      .inputOptions(['-ss', String(seekSecond)])
      .outputOptions([
        '-frames:v 1',
        '-q:v', String(quality),
        '-vf', `scale=${width}:-1:flags=lanczos`,
      ])
      .output(outFile)
      .on('end', () => resolve(outFile))
      .on('error', reject)
      .run()
  })
}

export function getWaveformData(inputPath: string, samples = 200): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(tempDir, `wave_${uuidv4()}.raw`)
    ffmpeg(inputPath)
      .audioChannels(1)
      .audioFrequency(8000)
      .format('s16le')
      .output(tempFile)
      .on('end', () => {
        try {
          const buf = fs.readFileSync(tempFile)
          const data: number[] = []
          const step = Math.floor(buf.length / 2 / samples)
          for (let i = 0; i < samples; i++) {
            const offset = i * step * 2
            const val = Math.abs(buf.readInt16LE(offset)) / 32768
            data.push(Math.round(val * 100) / 100)
          }
          fs.unlinkSync(tempFile)
          resolve(data)
        } catch (e) {
          reject(e)
        }
      })
      .on('error', reject)
      .run()
  })
}

export function checkFfmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg.getAvailableFormats((err) => {
      resolve(!err)
    })
  })
}

export function checkFfprobe(): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe('', (err) => {
      if (err && (err as any).code === 'ENOENT') {
        resolve(false)
      } else {
        resolve(true)
      }
    })
  })
}

export function cleanupTempPreviews(maxAgeMs?: number): void {
  const ageMs = maxAgeMs ?? Number(process.env.PREVIEW_TTL_MS || 60 * 60 * 1000)
  const now = Date.now()
  try {
    const files = fs.readdirSync(tempDir)
    for (const f of files) {
      if (!f.startsWith('export_') || !f.endsWith('.mp4')) continue
      const fp = path.join(tempDir, f)
      try {
        const stat = fs.statSync(fp)
        if (now - stat.mtimeMs > ageMs) fs.unlinkSync(fp)
      } catch {
      }
    }
  } catch {
  }
}

export function cleanupTempArtifacts(maxAgeMs?: number): void {
  const ageMs = maxAgeMs ?? Number(process.env.TEMP_ARTIFACT_TTL_MS || 30 * 60 * 1000)
  const now = Date.now()
  const removablePatterns = [
    /^export_.*\.mp4$/,
    /^whisper_.*\.wav$/,
    /^whisper_.*\.srt$/,
    /^wave_.*\.raw$/,
    /^concat_.*\.txt$/,
    /^title_text_.*\.txt$/,
  ]

  try {
    const files = fs.readdirSync(tempDir)
    for (const f of files) {
      if (!removablePatterns.some(pattern => pattern.test(f))) continue

      const fp = path.join(tempDir, f)
      try {
        const stat = fs.statSync(fp)
        if (now - stat.mtimeMs > ageMs) fs.unlinkSync(fp)
      } catch {
      }
    }
  } catch {
  }
}

export function cleanupTitleTextArtifacts(maxAgeMs = 0): void {
  const now = Date.now()

  try {
    const files = fs.readdirSync(tempDir)
    for (const f of files) {
      if (!/^title_text_.*\.txt$/i.test(f)) continue

      const fp = path.join(tempDir, f)
      try {
        const stat = fs.statSync(fp)
        if (now - stat.mtimeMs >= maxAgeMs) fs.unlinkSync(fp)
      } catch {
      }
    }
  } catch {
  }
}

export function deleteManagedCutOutput(filename: string): boolean {
  const safeName = path.basename(filename || '')
  if (!/^cut_[a-f0-9-]+\.mp4$/i.test(safeName)) return false

  const targetPath = path.join(outputDir, safeName)
  if (!fs.existsSync(targetPath)) return false

  fs.unlinkSync(targetPath)
  return true
}

export function cleanupStaleCutOutputs(maxAgeMs?: number): void {
  const ageMs = maxAgeMs ?? Number(process.env.CUT_OUTPUT_TTL_MS || 24 * 60 * 60 * 1000)
  const now = Date.now()

  try {
    const files = fs.readdirSync(outputDir)
    for (const f of files) {
      if (!/^cut_.*\.mp4$/i.test(f)) continue

      const fp = path.join(outputDir, f)
      try {
        const stat = fs.statSync(fp)
        if (now - stat.mtimeMs > ageMs) fs.unlinkSync(fp)
      } catch {
      }
    }
  } catch {
  }
}
