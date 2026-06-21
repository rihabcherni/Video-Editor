import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { cleanupTempArtifacts } from './ffmpeg'

const execFileAsync = promisify(execFile)

export async function generateSrtWithWhisper(params: {
  inputPath: string
  language?: string
  model?: 'tiny' | 'base' | 'small' | 'medium' | 'large' | 'large-v2' | 'large-v3' | 'large-v3-turbo'
  startTime?: number
  endTime?: number
  fast?: boolean
}) {
  const { inputPath, language, model = 'small', startTime, endTime, fast } = params

  const tempDir = path.join(process.cwd(), 'temp')
  const uploadsDir = path.join(process.cwd(), 'uploads')

  const wavPath = path.join(tempDir, `whisper_${uuidv4()}.wav`)
  const tempSrtPath = path.join(tempDir, `${path.parse(wavPath).name}.srt`)

  const whisperPy = process.env.WHISPER_PY_BIN || 'python3'
  const modelName = model
  const scriptPath = path.join(process.cwd(), 'scripts', 'transcribe_faster.py')
  const cleanupFileIfExists = (filePath: string) => {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch {

    }
  }

  cleanupTempArtifacts(0)
  const ffmpegArgs: string[] = ['-y']

  if (typeof startTime === 'number' && Number.isFinite(startTime) && startTime >= 0) {
    ffmpegArgs.push('-ss', String(startTime))
  }

  ffmpegArgs.push('-i', inputPath)

  if (
    typeof startTime === 'number' &&
    Number.isFinite(startTime) &&
    typeof endTime === 'number' &&
    Number.isFinite(endTime) &&
    endTime > startTime
  ) {
    const duration = endTime - startTime
    ffmpegArgs.push('-t', String(duration))
  } else if (typeof endTime === 'number' && Number.isFinite(endTime) && endTime > 0) {
    ffmpegArgs.push('-t', String(endTime))
  }

  ffmpegArgs.push(
    '-ac', '1',
    '-ar', '16000',
    '-vn',
    wavPath,
  )

  const timeoutMs = Number(process.env.WHISPER_TIMEOUT_MS || 20 * 60 * 1000)
  try {
    await execFileAsync('ffmpeg', ffmpegArgs, { timeout: timeoutMs })
  } catch (err: any) {
    cleanupFileIfExists(wavPath)
    const stderr = err?.stderr ? String(err.stderr).trim() : ''
    const stdout = err?.stdout ? String(err.stdout).trim() : ''
    const details = [stderr, stdout].filter(Boolean).join(' | ')
    throw new Error(details ? `Failed to extract audio for subtitles: ${details}` : 'Failed to extract audio for subtitles')
  }

  const args = [
    scriptPath,
    wavPath,
    tempSrtPath,
    modelName,
    language || 'auto',
  ]

  if (language && language !== 'auto') {
    args.push('--language', language)
  }
  if (fast) {
    args.push('--fast')
  }

  try {
    await execFileAsync(whisperPy, args, { timeout: timeoutMs })
  } catch (err: any) {
    cleanupFileIfExists(wavPath)
    cleanupFileIfExists(tempSrtPath)
    if (err.code === 'ENOENT') {
      throw new Error('python3 not found. Please install Python 3.')
    }
    const stderr = err?.stderr ? String(err.stderr).trim() : ''
    const stdout = err?.stdout ? String(err.stdout).trim() : ''
    const details = [stderr, stdout].filter(Boolean).join(' | ')
    const base = `openai-whisper failed (exit ${err?.code ?? 'unknown'})`
    throw new Error(details ? `${base}: ${details}` : base)
  }

  if (!fs.existsSync(tempSrtPath)) {
    cleanupFileIfExists(wavPath)
    throw new Error('Auto subtitles failed: no SRT produced')
  }

  const id = uuidv4()
  const outFilename = `sub_${id}.srt`
  const outPath = path.join(uploadsDir, outFilename)

  try {
    fs.renameSync(tempSrtPath, outPath)
  } catch (err: any) {
    if (err?.code === 'EXDEV') {
      fs.copyFileSync(tempSrtPath, outPath)
      fs.unlinkSync(tempSrtPath)
    } else {
      cleanupFileIfExists(wavPath)
      cleanupFileIfExists(tempSrtPath)
      throw err
    }
  }
  cleanupFileIfExists(wavPath)
  cleanupTempArtifacts(0)

  return { id, filename: outFilename, filepath: outPath }
}
