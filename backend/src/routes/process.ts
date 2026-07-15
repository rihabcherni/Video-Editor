import { FastifyInstance } from 'fastify'
import { cutVideo, splitVideo, mergeVideos, mergeClips, mergeSegments, mergeAudio, burnSubtitles, exportVideo, getVideoMeta, cleanupTempPreviews, cleanupStaleCutOutputs, cleanupTitleTextArtifacts, deleteManagedCutOutput } from '../utils/ffmpeg'
import type { TitleStyle } from '../utils/ffmpeg'
import path from 'path'
import fs from 'fs'

export async function processRoute(app: FastifyInstance) {
  const normalizeCrop = (crop?: {
    top?: number
    bottom?: number
    left?: number
    right?: number
  }) => {
    if (!crop) return undefined

    const top = Number(crop.top ?? 0)
    const bottom = Number(crop.bottom ?? 0)
    const left = Number(crop.left ?? 0)
    const right = Number(crop.right ?? 0)
    const values = { top, bottom, left, right }

    if (Object.values(values).some(value => !Number.isFinite(value) || value < 0 || value > 0.45)) {
      throw new Error('Crop values must be between 0 and 0.45.')
    }

    if (top + bottom >= 0.99 || left + right >= 0.99) {
      throw new Error('Crop values leave no visible area.')
    }

    if (top <= 0 && bottom <= 0 && left <= 0 && right <= 0) return undefined
    return values
  }

  const resolveMediaPath = (filename: string) => {
    const candidates = [
      path.join(process.cwd(), 'uploads', filename),
      path.join(process.cwd(), 'outputs', filename),
      path.join(process.cwd(), 'final-outputs', filename),
      path.join(process.cwd(), 'temp', filename),
    ]

    return candidates.find(candidate => fs.existsSync(candidate)) || null
  }

  const resolveFinalOutputPath = (filename: string) => {
    const safeName = path.basename(filename)
    const candidate = path.join(process.cwd(), 'final-outputs', safeName)
    return fs.existsSync(candidate) ? candidate : null
  }

  app.get('/export/download/:filename', async (req, reply) => {
    const { filename } = req.params as { filename: string }
    const filePath = resolveFinalOutputPath(filename)
    if (!filePath) return reply.code(404).send({ error: 'Export file not found' })

    const safeName = path.basename(filePath)
    reply.header('Content-Type', 'application/octet-stream')
    reply.header('Content-Disposition', `attachment; filename="${safeName}"`)
    return reply.send(fs.createReadStream(filePath))
  })

  app.post('/meta', async (req, reply) => {
    const { filename } = req.body as { filename: string }
    const filepath = resolveMediaPath(filename)
    if (!filepath) return reply.code(404).send({ error: 'File not found' })

    try {
      const meta = await getVideoMeta(filepath)
      const video = meta.streams.find(s => s.codec_type === 'video')
      const audio = meta.streams.find(s => s.codec_type === 'audio')
      return {
        duration: meta.format.duration,
        size: meta.format.size,
        bitrate: meta.format.bit_rate,
        video: video ? {
          codec: video.codec_name,
          width: video.width,
          height: video.height,
          fps: video.r_frame_rate,
        } : null,
        audio: audio ? {
          codec: audio.codec_name,
          sampleRate: audio.sample_rate,
          channels: audio.channels,
        } : null,
      }
    } catch (err) {
      app.log.error(err)
      return reply.code(500).send({ error: 'Cannot read video metadata' })
    }
  })

  app.post('/cut', async (req, reply) => {
    const { filename, startTime, endTime } = req.body as {
      filename: string
      startTime: number
      endTime: number
    }

    const inputPath = resolveMediaPath(filename)
    if (!inputPath) return reply.code(404).send({ error: 'File not found' })

    try {
      cleanupStaleCutOutputs()
      const outPath = await cutVideo({ inputPath, startTime, endTime })
      return { url: `/outputs/${path.basename(outPath)}`, filename: path.basename(outPath) }
    } catch (err: unknown) {
      app.log.error(err)
      const message = err instanceof Error ? err.message : 'Cut failed'
      return reply.code(500).send({ error: message })
    }
  })

  app.post('/split-video', async (req, reply) => {
    const { filename, segments } = req.body as {
      filename: string
      segments: { startTime: number; endTime: number; label?: string }[]
    }

    const inputPath = resolveMediaPath(filename)
    if (!inputPath) return reply.code(404).send({ error: 'File not found' })
    if (!Array.isArray(segments) || segments.length === 0) {
      return reply.code(400).send({ error: 'No segments provided' })
    }

    const invalidSegment = segments.find(segment => (
      typeof segment.startTime !== 'number'
      || typeof segment.endTime !== 'number'
      || segment.endTime <= segment.startTime
    ))
    if (invalidSegment) {
      return reply.code(400).send({ error: 'Invalid segment range' })
    }

    try {
      cleanupStaleCutOutputs()
      const outPaths = await splitVideo(inputPath, segments)
      return {
        segments: outPaths.map((outPath, index) => ({
          filename: path.basename(outPath),
          url: `/outputs/${path.basename(outPath)}`,
          label: segments[index]?.label,
        })),
      }
    } catch (err: unknown) {
      app.log.error(err)
      const message = err instanceof Error ? err.message : 'Split failed'
      return reply.code(500).send({ error: message })
    }
  })

  app.post('/output/delete', async (req, reply) => {
    const { filename } = req.body as { filename?: string }
    if (!filename) return reply.code(400).send({ error: 'Filename required' })

    try {
      const deleted = deleteManagedCutOutput(filename)
      return { ok: true, deleted }
    } catch (err: unknown) {
      app.log.error(err)
      return reply.code(500).send({ error: err instanceof Error ? err.message : 'Delete failed' })
    }
  })

  app.post('/merge-videos', async (req, reply) => {
    const { filenames } = req.body as { filenames: string[] }
    if (!Array.isArray(filenames) || filenames.length < 2) {
      return reply.code(400).send({ error: 'At least two segments are required' })
    }

    const inputPaths = filenames.map(resolveMediaPath)
    if (inputPaths.some(inputPath => !inputPath)) {
      return reply.code(404).send({ error: 'One or more segments were not found' })
    }

    try {
      const outPath = await mergeVideos({ inputPaths: inputPaths as string[] })
      return { url: `/outputs/${path.basename(outPath)}`, filename: path.basename(outPath) }
    } catch (err: unknown) {
      app.log.error(err)
      const message = err instanceof Error ? err.message : 'Merge failed'
      return reply.code(500).send({ error: message })
    }
  })

  app.post('/merge-clips', async (req, reply) => {
    const { clips, audioTracks } = req.body as {
      clips: { filename: string; startTime: number; endTime: number }[]
      audioTracks?: { filename: string; startTime?: number; endTime?: number; offset?: number }[]
    }

    if (!Array.isArray(clips) || clips.length === 0) {
      return reply.code(400).send({ error: 'At least one clip is required' })
    }

    const resolvedClips = clips.map(clip => ({
      inputPath: resolveMediaPath(clip.filename),
      startTime: clip.startTime,
      endTime: clip.endTime,
    }))

    const missingClip = resolvedClips.find(clip => !clip.inputPath)
    if (missingClip) {
      return reply.code(404).send({ error: 'One or more video files were not found' })
    }

    const resolvedAudioTracks = audioTracks
      ? audioTracks.map(track => ({
          inputPath: resolveMediaPath(track.filename) || path.join(process.cwd(), 'uploads', track.filename),
          startTime: track.startTime,
          endTime: track.endTime,
          offset: track.offset,
        }))
      : undefined

    if (resolvedAudioTracks) {
      const missingAudio = resolvedAudioTracks.find(track => !fs.existsSync(track.inputPath))
      if (missingAudio) {
        return reply.code(404).send({ error: 'One or more audio files were not found' })
      }
    }

    try {
      const outPath = await mergeClips(
        resolvedClips as { inputPath: string; startTime: number; endTime: number }[],
        resolvedAudioTracks
      )
      return { url: `/outputs/${path.basename(outPath)}`, filename: path.basename(outPath) }
    } catch (err: unknown) {
      app.log.error(err)
      const message = err instanceof Error ? err.message : 'Merge clips failed'
      return reply.code(500).send({ error: message })
    }
  })

  app.post('/merge-segments', async (req, reply) => {
    const { filename, segments } = req.body as {
      filename: string
      segments: { startTime: number; endTime: number; label?: string }[]
    }

    const inputPath = resolveMediaPath(filename)
    if (!inputPath) return reply.code(404).send({ error: 'File not found' })
    if (!Array.isArray(segments) || segments.length < 2) {
      return reply.code(400).send({ error: 'At least two segments are required' })
    }

    const invalidSegment = segments.find(segment => (
      typeof segment.startTime !== 'number'
      || typeof segment.endTime !== 'number'
      || segment.endTime <= segment.startTime
    ))
    if (invalidSegment) {
      return reply.code(400).send({ error: 'Invalid segment range' })
    }

    try {
      const outPath = await mergeSegments({ inputPath, segments })
      return { url: `/outputs/${path.basename(outPath)}`, filename: path.basename(outPath) }
    } catch (err: unknown) {
      app.log.error(err)
      const message = err instanceof Error ? err.message : 'Merge failed'
      return reply.code(500).send({ error: message })
    }
  })

  app.post('/merge-audio', async (req, reply) => {
    const { videoFilename, audioFilename, replaceOriginal } = req.body as {
      videoFilename: string
      audioFilename: string
      replaceOriginal?: boolean
    }

    const inputPath = resolveMediaPath(videoFilename)
    const audioPath = resolveMediaPath(audioFilename)

    if (!inputPath) return reply.code(404).send({ error: 'Video not found' })
    if (!audioPath) return reply.code(404).send({ error: 'Audio not found' })

    try {
      const outPath = await mergeAudio({ inputPath, audioPath, replaceOriginal })
      return { url: `/outputs/${path.basename(outPath)}`, filename: path.basename(outPath) }
    } catch (err: unknown) {
      app.log.error(err)
      const message = err instanceof Error ? err.message : 'Audio merge failed'
      return reply.code(500).send({ error: message })
    }
  })

  app.post('/export', async (req, reply) => {
    const body = req.body as {
      filename: string
      quality?: '480p' | '720p' | '1080p'
      aspectRatio?: 'original' | '16:9' | '9:16' | '1:1' | '4:5' | '5:4' | '4:3' | '3:2'
      outputName?: string
      startTime?: number
      endTime?: number
      crop?: {
        top?: number
        bottom?: number
        left?: number
        right?: number
      }
      audioFilename?: string
      audioStartTime?: number
      audioEndTime?: number
      audioOffset?: number
      subtitleFilename?: string
      subtitleStyle?: {
        size?: number
        color?: string
        position?: 'bottom' | 'middle' | 'top'
      }
      titleStyle?: TitleStyle
      borderStyle?: {
        enabled?: boolean
        sizeX?: number
        sizeY?: number
        color?: string
        mode?: 'outside'
      }
      logoFilename?: string
      logoSize?: number
      logoX?: number
      logoY?: number
      replaceOriginal?: boolean
    }

    const inputPath = resolveMediaPath(body.filename)
    if (!inputPath) return reply.code(404).send({ error: 'File not found' })

    const audioPath = body.audioFilename
      ? resolveMediaPath(body.audioFilename) || path.join(process.cwd(), 'uploads', body.audioFilename)
      : undefined

    const subtitlePath = body.subtitleFilename
      ? resolveMediaPath(body.subtitleFilename) || path.join(process.cwd(), 'uploads', body.subtitleFilename)
      : undefined

    const logoPath = body.logoFilename
      ? resolveMediaPath(body.logoFilename) || path.join(process.cwd(), 'uploads', body.logoFilename)
      : undefined

    if (logoPath && !fs.existsSync(logoPath)) {
      return reply.code(404).send({ error: 'Logo image not found' })
    }

    try {
      cleanupTitleTextArtifacts()
      const crop = normalizeCrop(body.crop)
      console.log('--- POST /api/export ---')
      console.log('body:', JSON.stringify({
        filename: body.filename,
        audioFilename: body.audioFilename,
        replaceOriginal: body.replaceOriginal,
        logoFilename: body.logoFilename,
        logoSize: body.logoSize,
        logoX: body.logoX,
        logoY: body.logoY,
        crop,
      }))
      const outPath = await exportVideo({
        inputPath,
        quality: body.quality || '720p',
        aspectRatio: body.aspectRatio,
        outputName: body.outputName,
        startTime: body.startTime,
        endTime: body.endTime,
        crop,
        audioPath,
        audioStartTime: body.audioStartTime,
        audioEndTime: body.audioEndTime,
        audioOffset: body.audioOffset,
        subtitlePath,
        subtitleStyle: body.subtitleStyle,
        titleStyle: body.titleStyle,
        borderStyle: body.borderStyle,
        logoPath,
        logoSize: body.logoSize,
        logoX: body.logoX,
        logoY: body.logoY,
        replaceOriginal: body.replaceOriginal,
        outputDir: path.join(process.cwd(), 'final-outputs'),
      })
      const filename = path.basename(outPath)
      return {
        url: `/final-outputs/${filename}`,
        downloadUrl: `/api/export/download/${encodeURIComponent(filename)}`,
        filename,
      }
    } catch (err: unknown) {
      app.log.error(err)
      const message = err instanceof Error ? err.message : 'Export failed'
      return reply.code(500).send({ error: message })
    }
  })

  app.post('/preview', async (req, reply) => {
    const body = req.body as {
      filename: string
      quality?: '480p' | '720p' | '1080p'
      aspectRatio?: 'original' | '16:9' | '9:16' | '1:1' | '4:5' | '5:4' | '4:3' | '3:2'
      outputName?: string
      startTime?: number
      endTime?: number
      crop?: {
        top?: number
        bottom?: number
        left?: number
        right?: number
      }
      audioFilename?: string
      audioStartTime?: number
      audioEndTime?: number
      audioOffset?: number
      subtitleFilename?: string
      subtitleStyle?: {
        size?: number
        color?: string
        position?: 'bottom' | 'middle' | 'top'
      }
      titleStyle?: TitleStyle
      borderStyle?: {
        enabled?: boolean
        sizeX?: number
        sizeY?: number
        color?: string
        mode?: 'outside'
      }
      logoFilename?: string
      logoSize?: number
      logoX?: number
      logoY?: number
      replaceOriginal?: boolean
    }

    const inputPath = resolveMediaPath(body.filename)
    if (!inputPath) return reply.code(404).send({ error: 'File not found' })

    const audioPath = body.audioFilename
      ? resolveMediaPath(body.audioFilename) || path.join(process.cwd(), 'uploads', body.audioFilename)
      : undefined

    const subtitlePath = body.subtitleFilename
      ? resolveMediaPath(body.subtitleFilename) || path.join(process.cwd(), 'uploads', body.subtitleFilename)
      : undefined

    const logoPath = body.logoFilename
      ? resolveMediaPath(body.logoFilename) || path.join(process.cwd(), 'uploads', body.logoFilename)
      : undefined

    if (logoPath && !fs.existsSync(logoPath)) {
      return reply.code(404).send({ error: 'Logo image not found' })
    }

    try {
      cleanupTitleTextArtifacts()
      const crop = normalizeCrop(body.crop)
      cleanupTempPreviews()
      const outPath = await exportVideo({
        inputPath,
        quality: body.quality || '720p',
        aspectRatio: body.aspectRatio,
        outputName: body.outputName,
        startTime: body.startTime,
        endTime: body.endTime,
        crop,
        audioPath,
        audioStartTime: body.audioStartTime,
        audioEndTime: body.audioEndTime,
        audioOffset: body.audioOffset,
        subtitlePath,
        subtitleStyle: body.subtitleStyle,
        titleStyle: body.titleStyle,
        borderStyle: body.borderStyle,
        logoPath,
        logoSize: body.logoSize,
        logoX: body.logoX,
        logoY: body.logoY,
        replaceOriginal: body.replaceOriginal,
        outputDir: path.join(process.cwd(), 'temp'),
      })
      return { url: `/temp/${path.basename(outPath)}`, filename: path.basename(outPath) }
    } catch (err: unknown) {
      app.log.error(err)
      const message = err instanceof Error ? err.message : 'Preview failed'
      return reply.code(500).send({ error: message })
    }
  })
}
