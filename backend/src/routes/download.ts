import { FastifyInstance } from 'fastify'
import { downloadVideo, downloadAudio, getVideoInfo } from '../utils/ytdlp'
import { getVideoMeta, generateThumbnail } from '../utils/ffmpeg'
import path from 'path'

export async function downloadRoute(app: FastifyInstance) {
  app.post('/info', async (req, reply) => {
    const { url } = req.body as { url: string }
    if (!url) return reply.code(400).send({ error: 'URL required' })

    try {
      const info = await getVideoInfo(url)
      return {
        title: info.title,
        duration: info.duration,
        thumbnail: info.thumbnail,
        uploader: info.uploader,
        platform: info.extractor,
      }
    } catch (err) {
      return reply.code(400).send({ error: 'Cannot fetch video info. Check the URL.' })
    }
  })

  app.post('/download', async (req, reply) => {
    const { url } = req.body as { url: string }
    if (!url) return reply.code(400).send({ error: 'URL required' })

    const supportedDomains = ['youtube.com', 'youtu.be', 'instagram.com', 'facebook.com', 'fb.com', 'tiktok.com']
    const isSupported = supportedDomains.some(d => url.includes(d))
    if (!isSupported) {
      return reply.code(400).send({ error: 'Unsupported platform. Supported: YouTube, Instagram, Facebook, TikTok' })
    }

    try {
      const result = await downloadVideo(url)

      let duration = result.duration
      let thumbnailUrl: string | null = null
      const [metaResult, thumbnailResult] = await Promise.allSettled([
        duration > 0 ? Promise.resolve(null) : getVideoMeta(result.filepath),
        generateThumbnail(result.filepath, 2),
      ])

      if (metaResult.status === 'fulfilled' && metaResult.value) {
        const meta = metaResult.value
        duration = meta.format.duration || duration
      }
      if (thumbnailResult.status === 'fulfilled') {
        thumbnailUrl = `/final-outputs/${path.basename(thumbnailResult.value)}`
      }

      return {
        id: result.id,
        title: result.title,
        duration,
        url: result.url,
        thumbnail: thumbnailUrl || result.thumbnail,
        filename: result.filename,
      }
    } catch (err: unknown) {
      app.log.error(err)
      const message = err instanceof Error ? err.message : 'Download failed'
      const isClientError = message.toLowerCase().includes('unsupported') || message.toLowerCase().includes('private')
      const debug = String(process.env.YTDLP_DEBUG || '').toLowerCase() === 'true'
      return reply.code(isClientError ? 400 : 500).send(debug ? { error: message, debug: message } : { error: message })
    }
  })

  app.post('/download-audio', async (req, reply) => {
    const { url } = req.body as { url: string }
    if (!url) return reply.code(400).send({ error: 'URL required' })

    try {
      const result = await downloadAudio(url)
      return { id: result.id, filename: result.filename, url: result.url }
    } catch (err: unknown) {
      app.log.error(err)
      const message = err instanceof Error ? err.message : 'Audio download failed'
      const debug = String(process.env.YTDLP_DEBUG || '').toLowerCase() === 'true'
      return reply.code(500).send(debug ? { error: message, debug: message } : { error: message })
    }
  })
}
