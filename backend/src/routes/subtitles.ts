import { FastifyInstance } from 'fastify'
import { pipeline } from 'stream/promises'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { burnSubtitles } from '../utils/ffmpeg'
import { generateSrtWithWhisper } from '../utils/whisper'

export interface SubtitleEntry {
  index: number
  startTime: string 
  endTime: string
  text: string
}

const SRT_TIMING_PATTERN = /^\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})(?:\s+.*)?$/

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function removeFileIfExists(filepath: string) {
  if (!fs.existsSync(filepath)) return
  fs.unlinkSync(filepath)
}

function normalizeTimestamp(value: string): string {
  return value.trim().replace('.', ',')
}

function parseSRT(content: string): SubtitleEntry[] {
  const normalizedContent = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()
  if (!normalizedContent) {
    throw new Error('Subtitle file is empty')
  }

  const blocks = normalizedContent.split(/\n{2,}/).map(block => block.trim()).filter(Boolean)

  return blocks.map((block, blockIndex) => {
    const lines = block.split('\n').map(line => line.trimEnd())
    const firstLine = lines[0]?.trim() ?? ''

    let index = blockIndex + 1
    let timingLine = firstLine
    let textStartIndex = 1

    if (!firstLine.includes('-->')) {
      index = Number.parseInt(firstLine, 10)
      if (!Number.isInteger(index)) {
        throw new Error(`Invalid subtitle index in block ${blockIndex + 1}`)
      }
      timingLine = lines[1]?.trim() ?? ''
      textStartIndex = 2
    }

    const timingMatch = timingLine.match(SRT_TIMING_PATTERN)
    if (!timingMatch) {
      throw new Error(`Invalid time range in block ${blockIndex + 1}`)
    }

    const startTime = normalizeTimestamp(timingMatch[1])
    const endTime = normalizeTimestamp(timingMatch[2])
    const text = lines.slice(textStartIndex).join('\n').trim()

    if (!text) {
      throw new Error(`Missing subtitle text in block ${blockIndex + 1}`)
    }

    return { index, startTime, endTime, text }
  })
}

function generateSRT(entries: SubtitleEntry[]): string {
  return entries.map(e =>
    `${e.index}\n${e.startTime} --> ${e.endTime}\n${e.text}`
  ).join('\n\n')
}

export async function subtitleRoute(app: FastifyInstance) {
  const resolveVideoPath = (filename: string): string | null => {
    const uploadPath = path.join(process.cwd(), 'uploads', filename)
    if (fs.existsSync(uploadPath)) return uploadPath

    const outputPath = path.join(process.cwd(), 'outputs', filename)
    if (fs.existsSync(outputPath)) return outputPath

    const finalOutputPath = path.join(process.cwd(), 'final-outputs', filename)
    if (fs.existsSync(finalOutputPath)) return finalOutputPath

    return null
  }

  app.post('/subtitle/upload', async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.code(400).send({ error: 'No file' })

    const id = uuidv4()
    const filename = `sub_${id}.srt`
    const filepath = path.join(process.cwd(), 'uploads', filename)

    await pipeline(data.file, fs.createWriteStream(filepath))

    try {
      const content = fs.readFileSync(filepath, 'utf-8')
      const entries = parseSRT(content)

      return { id, filename, entries }
    } catch (err: unknown) {
      removeFileIfExists(filepath)
      return reply.code(400).send({ error: toErrorMessage(err, 'Invalid subtitle file') })
    }
  })

  app.post('/subtitle/create', async (req, reply) => {
    const { entries } = req.body as { entries: SubtitleEntry[] }

    const id = uuidv4()
    const filename = `sub_${id}.srt`
    const filepath = path.join(process.cwd(), 'uploads', filename)

    const content = generateSRT(entries)
    fs.writeFileSync(filepath, content, 'utf-8')

    return { id, filename, url: `/uploads/${filename}` }
  })

  app.post('/subtitle/burn', async (req, reply) => {
    const { videoFilename, subtitleFilename, style } = req.body as {
      videoFilename: string
      subtitleFilename: string
      style?: {
        size?: number
        color?: string
        position?: 'bottom' | 'middle' | 'top'
      }
    }

    const inputPath = resolveVideoPath(videoFilename)
    const subtitlePath = path.join(process.cwd(), 'uploads', subtitleFilename)

    if (!inputPath) return reply.code(404).send({ error: 'Video not found' })
    if (!fs.existsSync(subtitlePath)) return reply.code(404).send({ error: 'Subtitle not found' })

    try {
      const outPath = await burnSubtitles({ inputPath, subtitlePath, style })
      return { url: `/outputs/${path.basename(outPath)}`, filename: path.basename(outPath) }
    } catch (err: unknown) {
      return reply.code(500).send({ error: toErrorMessage(err, 'Subtitle burn failed') })
    }
  })

  app.post('/subtitle/auto', async (req, reply) => {
    const { videoFilename, language, model, startTime, endTime, fast } = req.body as {
      videoFilename: string
      language?: string
      model?: 'tiny' | 'base' | 'small' | 'medium' | 'large' | 'large-v2' | 'large-v3' | 'large-v3-turbo'
      startTime?: number
      endTime?: number
      fast?: boolean
    }

    const inputPath = resolveVideoPath(videoFilename)
    if (!inputPath) return reply.code(404).send({ error: 'Video not found' })

    try {
      const { id, filename, filepath } = await generateSrtWithWhisper({
        inputPath,
        language,
        model,
        startTime,
        endTime,
        fast,
      })
      const content = fs.readFileSync(filepath, 'utf-8')
      const entries = parseSRT(content)
      return { id, filename, entries }
    } catch (err: unknown) {
      return reply.code(500).send({ error: toErrorMessage(err, 'Auto subtitles failed') })
    }
  })
}
