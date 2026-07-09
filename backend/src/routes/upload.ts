import { FastifyInstance } from 'fastify'
import { pipeline } from 'stream/promises'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { getVideoMeta, generateThumbnail } from '../utils/ffmpeg'
import { validateCookiesFile } from '../utils/ytdlp'

const uploadDir = path.join(process.cwd(), 'uploads')
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.mpeg', '.mpg'])
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.aac', '.flac', '.m4a', '.ogg', '.opus', '.weba', '.webm'])

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function removeFileIfExists(filePath: string) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {
  }
}

function isAllowedMediaUpload(kind: 'video' | 'audio', mimetype: string, ext: string) {
  const normalizedMime = (mimetype || '').toLowerCase()
  const normalizedExt = ext.toLowerCase()
  const allowedExtensions = kind === 'video' ? VIDEO_EXTENSIONS : AUDIO_EXTENSIONS

  if (allowedExtensions.has(normalizedExt)) return true
  if (kind === 'video') return normalizedMime.startsWith('video/')
  return normalizedMime.startsWith('audio/') || normalizedMime === 'application/ogg'
}

function resolveStoredExtension(kind: 'video' | 'audio', ext: string) {
  const normalizedExt = ext.toLowerCase()
  const allowedExtensions = kind === 'video' ? VIDEO_EXTENSIONS : AUDIO_EXTENSIONS
  if (allowedExtensions.has(normalizedExt)) return normalizedExt
  return kind === 'video' ? '.mp4' : '.mp3'
}

function getUploadValidationMessage(kind: 'video' | 'audio') {
  return kind === 'video'
    ? 'Please upload a supported video file (MP4, MOV, AVI, MKV, WEBM)'
    : 'Please upload a supported audio file (MP3, WAV, AAC, FLAC, M4A, OGG, OPUS)'
}

async function validateUploadedMedia(filePath: string, kind: 'video' | 'audio') {
  let meta
  try {
    meta = await getVideoMeta(filePath)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Media validation failed'
    if (message.includes('ffprobe not found')) throw error
    throw new Error(kind === 'video' ? 'Please upload a valid video file' : 'Please upload a valid audio file')
  }

  const hasExpectedStream = meta.streams.some(stream => stream.codec_type === kind)
  if (!hasExpectedStream) {
    throw new Error(kind === 'video' ? 'Please upload a valid video file' : 'Please upload a valid audio file')
  }

  return meta
}

export async function uploadRoute(app: FastifyInstance) {
  app.post('/upload', async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.code(400).send({ error: 'No file uploaded' })

    const originalExt = path.extname(data.filename || '').toLowerCase()
    if (!isAllowedMediaUpload('video', data.mimetype, originalExt)) {
      data.file.resume()
      return reply.code(400).send({ error: getUploadValidationMessage('video') })
    }

    ensureDir(uploadDir)

    const ext = resolveStoredExtension('video', originalExt)
    const id = uuidv4()
    const filename = `${id}${ext}`
    const filepath = path.join(uploadDir, filename)
    const tempPath = path.join(uploadDir, `${id}.upload${ext}`)

    try {
      await pipeline(data.file, fs.createWriteStream(tempPath))
    } catch (error: unknown) {
      removeFileIfExists(tempPath)
      app.log.error(error)
      return reply.code(500).send({ error: 'Failed to save uploaded video' })
    }

    let meta
    try {
      meta = await validateUploadedMedia(tempPath, 'video')
    } catch (error: unknown) {
      removeFileIfExists(tempPath)
      const message = error instanceof Error ? error.message : 'Video validation failed'
      if (message.includes('ffprobe not found')) {
        app.log.error(error)
        return reply.code(500).send({ error: message })
      }
      return reply.code(400).send({ error: message })
    }

    try {
      fs.renameSync(tempPath, filepath)
    } catch (error: unknown) {
      removeFileIfExists(tempPath)
      removeFileIfExists(filepath)
      app.log.error(error)
      return reply.code(500).send({ error: 'Failed to finalize uploaded video' })
    }

    let thumbnailUrl: string | null = null
    try {
      const thumbnailPath = await generateThumbnail(filepath, 1)
      thumbnailUrl = `/final-outputs/${path.basename(thumbnailPath)}`
    } catch {
    }

    return {
      id,
      title: data.filename,
      duration: meta.format.duration || 0,
      url: `/uploads/${filename}`,
      thumbnail: thumbnailUrl,
      filename,
    }
  })

  app.post('/upload-audio', async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.code(400).send({ error: 'No file uploaded' })

    const originalExt = path.extname(data.filename || '').toLowerCase()
    if (!isAllowedMediaUpload('audio', data.mimetype, originalExt)) {
      data.file.resume()
      return reply.code(400).send({ error: getUploadValidationMessage('audio') })
    }

    ensureDir(uploadDir)

    const ext = resolveStoredExtension('audio', originalExt)
    const id = uuidv4()
    const filename = `audio_${id}${ext}`
    const filepath = path.join(uploadDir, filename)
    const tempPath = path.join(uploadDir, `audio_${id}.upload${ext}`)

    try {
      await pipeline(data.file, fs.createWriteStream(tempPath))
    } catch (error: unknown) {
      removeFileIfExists(tempPath)
      app.log.error(error)
      return reply.code(500).send({ error: 'Failed to save uploaded audio' })
    }

    try {
      await validateUploadedMedia(tempPath, 'audio')
    } catch (error: unknown) {
      removeFileIfExists(tempPath)
      const message = error instanceof Error ? error.message : 'Audio validation failed'
      if (message.includes('ffprobe not found')) {
        app.log.error(error)
        return reply.code(500).send({ error: message })
      }
      return reply.code(400).send({ error: message })
    }

    try {
      fs.renameSync(tempPath, filepath)
    } catch (error: unknown) {
      removeFileIfExists(tempPath)
      removeFileIfExists(filepath)
      app.log.error(error)
      return reply.code(500).send({ error: 'Failed to finalize uploaded audio' })
    }

    return {
      id,
      filename,
      url: `/uploads/${filename}`,
    }
  })

  app.post('/upload-image', async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.code(400).send({ error: 'No file uploaded' })

    if (!data.mimetype.startsWith('image/')) {
      data.file.resume()
      return reply.code(400).send({ error: 'Please upload an image file' })
    }

    const ext = path.extname(data.filename) || '.png'
    const id = uuidv4()
    const filename = `img_${id}${ext}`
    const filepath = path.join(process.cwd(), 'uploads', filename)

    await pipeline(data.file, fs.createWriteStream(filepath))

    return {
      id,
      filename,
      url: `/uploads/${filename}`,
    }
  })

  app.post('/cookies/upload', async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.code(400).send({ error: 'No file uploaded' })

    const ext = path.extname(data.filename || '').toLowerCase()
    if (ext && ext !== '.txt') {
      data.file.resume()
      return reply.code(400).send({ error: 'Please upload a .txt cookies file' })
    }

    const envPath = process.env.YTDLP_COOKIES
    let targetPath = envPath
      ? envPath
      : path.join(process.cwd(), 'cookies', 'ytdlp_cookies.txt')
    if (targetPath && fs.existsSync(targetPath)) {
      try {
        const stat = fs.statSync(targetPath)
        if (stat.isDirectory()) {
          targetPath = path.join(targetPath, 'ytdlp_cookies.txt')
        }
      } catch {  }
    }
    if (targetPath && !path.extname(targetPath)) {
      targetPath = path.join(targetPath, 'ytdlp_cookies.txt')
    }

    const targetDir = path.dirname(targetPath)
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })

    if (fs.existsSync(targetPath)) {
      try {
        const stat = fs.statSync(targetPath)
        if (stat.isDirectory()) {
          fs.rmSync(targetPath, { recursive: true, force: true })
        }
      } catch { /* ignore */ }
    }

    await pipeline(data.file, fs.createWriteStream(targetPath))

    const validationError = validateCookiesFile(targetPath)
    if (validationError) {
      try { fs.unlinkSync(targetPath) } catch { /* ignore */ }
      return reply.code(400).send({ error: validationError })
    }

    return { ok: true, path: targetPath }
  })
}
