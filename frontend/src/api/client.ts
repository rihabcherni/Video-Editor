import axios from 'axios'
import { withMediaBase } from '../utils/media'
import type { TitleRenderLayout } from '../utils/titleLayout'

const apiBase = import.meta.env.VITE_API_BASE_URL || '/api'
const api = axios.create({ baseURL: apiBase })

function withApiBase(url: string): string {
  if (!url) return url
  if (url.startsWith('http')) return url
  if (url.startsWith(apiBase)) return url
  return api.getUri({ url })
}

export function getApiErrorMessage(error: unknown, fallbackMessage: string) {
  if (axios.isAxiosError(error)) {
    const apiMessage = error.response?.data?.error
    if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage
    if (error.message) return error.message
  }
  if (error instanceof Error && error.message) return error.message
  return fallbackMessage
}

export interface VideoInfo {
  id: string
  title: string
  duration: number
  url: string
  thumbnail?: string
  filename: string
}

export interface SubtitleEntry {
  index: number
  startTime: string
  endTime: string
  text: string
}

export interface SubtitleStyle {
  size: number
  color: string
  backgroundColor: string
}

export interface TitleStyle {
  text: string
  font: string
  size: number
  color: string
  bgColor?: string
  borderColor?: string
  borderWidth?: number
  frameColor?: string
  frameWidth?: number
  padding?: number
  lineSpacing?: number
  align?: 'left' | 'center' | 'right'
  position?: 'top-left' | 'top' | 'top-right' | 'middle-left' | 'middle' | 'middle-right' | 'bottom-left' | 'bottom' | 'bottom-right'
  frameMode?: 'inside' | 'outside'
  x?: number
  y?: number
  layout?: TitleRenderLayout
}

export interface BorderStyle {
  enabled: boolean
  sizeX?: number
  sizeY?: number
  color: string
  mode?: 'inside' | 'outside'
}

export interface CropSettings {
  top: number
  bottom: number
  left: number
  right: number
}

export interface SegmentDefinition {
  startTime: number
  endTime: number
  label?: string
}

export const downloadFromUrl = async (url: string): Promise<VideoInfo> => {
  const { data } = await api.post('/download', { url })
  return {
    ...data,
    url: withMediaBase(data.url),
    thumbnail: withMediaBase(data.thumbnail),
  }
}

export const getVideoInfo = async (url: string) => {
  const { data } = await api.post('/info', { url })
  return data
}

export const uploadVideo = async (file: File, onProgress?: (pct: number) => void): Promise<VideoInfo> => {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e => onProgress?.(Math.round((e.loaded * 100) / (e.total || 1))),
  })
  return {
    ...data,
    url: withMediaBase(data.url),
    thumbnail: withMediaBase(data.thumbnail),
  }
}

export const uploadAudio = async (file: File): Promise<{ id: string; filename: string; url: string }> => {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/upload-audio', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return { ...data, url: withMediaBase(data.url) }
}

export const uploadImage = async (file: File): Promise<{ id: string; filename: string; url: string }> => {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/upload-image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export const downloadAudioFromUrl = async (url: string): Promise<{ id: string; filename: string; url: string }> => {
  const { data } = await api.post('/download-audio', { url })
  return { ...data, url: withMediaBase(data.url) }
}

export const cutVideo = async (filename: string, startTime: number, endTime: number) => {
  const { data } = await api.post('/cut', { filename, startTime, endTime })
  return { ...data, url: withMediaBase(data.url) } as { url: string; filename: string }
}

export const splitVideo = async (filename: string, segments: SegmentDefinition[]) => {
  const { data } = await api.post('/split-video', { filename, segments })
  return {
    ...data,
    segments: data.segments.map((segment: { url: string; filename: string; label?: string }) => ({
      ...segment,
      url: withMediaBase(segment.url),
    })),
  } as {
    segments: { url: string; filename: string; label?: string }[]
  }
}

export const deleteOutputFile = async (filename: string) => {
  const { data } = await api.post('/output/delete', { filename })
  return data as { ok: true; deleted: boolean }
}

export const deleteUploadedFile = async (filename: string) => {
  const { data } = await api.post('/upload/delete', { filename })
  return data as { ok: true; deleted: boolean }
}

export const deleteUploadedFiles = async (filenames: string[]) => {
  const { data } = await api.post('/upload/delete-many', { filenames })
  return data as { ok: true; deleted: number }
}

export const mergeVideos = async (filenames: string[]) => {
  const { data } = await api.post('/merge-videos', { filenames })
  return { ...data, url: withMediaBase(data.url) } as { url: string; filename: string }
}

export const mergeClips = async (params: {
  clips: { filename: string; startTime: number; endTime: number }[]
  audioTracks?: { filename: string; startTime?: number; endTime?: number; offset?: number }[]
}) => {
  const { data } = await api.post('/merge-clips', params)
  return { ...data, url: withMediaBase(data.url) } as { url: string; filename: string }
}

export const mergeSegments = async (filename: string, segments: SegmentDefinition[]) => {
  const { data } = await api.post('/merge-segments', { filename, segments })
  return { ...data, url: withMediaBase(data.url) } as { url: string; filename: string }
}

export const mergeAudio = async (
  videoFilename: string,
  audioFilename: string,
  replaceOriginal = false
) => {
  const { data } = await api.post('/merge-audio', { videoFilename, audioFilename, replaceOriginal })
  return { ...data, url: withMediaBase(data.url) } as { url: string; filename: string }
}

export const createSubtitles = async (entries: SubtitleEntry[]) => {
  const { data } = await api.post('/subtitle/create', { entries })
  return { ...data, url: withMediaBase(data.url) } as { id: string; filename: string; url: string }
}

export const uploadSubtitle = async (file: File) => {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/subtitle/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data as { id: string; filename: string; entries: SubtitleEntry[] }
}

export const autoSubtitles = async (params: {
  videoFilename: string
  language?: string
  model?: 'tiny' | 'base' | 'small' | 'medium' | 'large' | 'large-v2' | 'large-v3' | 'large-v3-turbo'
  startTime?: number
  endTime?: number
  fast?: boolean
}) => {
  const { data } = await api.post('/subtitle/auto', params)
  return data as { id: string; filename: string; entries: SubtitleEntry[] }
}

export const burnSubtitles = async (videoFilename: string, subtitleFilename: string, style?: SubtitleStyle) => {
  const { data } = await api.post('/subtitle/burn', { videoFilename, subtitleFilename, style })
  return { ...data, url: withMediaBase(data.url) } as { url: string; filename: string }
}

export const exportVideo = async (params: {
  filename: string
  quality: '480p' | '720p' | '1080p'
  aspectRatio?: 'original' | '16:9' | '9:16' | '1:1' | '4:5' | '5:4' | '4:3' | '3:2'
  outputName?: string
  startTime?: number
  endTime?: number
  crop?: CropSettings
  audioFilename?: string
  audioStartTime?: number
  audioEndTime?: number
  subtitleFilename?: string
  subtitleStyle?: SubtitleStyle
  titleStyle?: TitleStyle
  borderStyle?: BorderStyle
  logoFilename?: string
  logoSize?: number
  logoX?: number
  logoY?: number
  replaceOriginal?: boolean
  audioOffset?: number
}) => {
  const { data } = await api.post('/export', params)
  return {
    ...data,
    url: withMediaBase(data.url),
    downloadUrl: withApiBase(data.downloadUrl || `/export/download/${encodeURIComponent(data.filename)}`),
  } as { url: string; downloadUrl: string; filename: string }
}

export const previewVideo = async (params: {
  filename: string
  quality: '480p' | '720p' | '1080p'
  aspectRatio?: 'original' | '16:9' | '9:16' | '1:1' | '4:5' | '5:4' | '4:3' | '3:2'
  startTime?: number
  endTime?: number
  crop?: CropSettings
  audioFilename?: string
  audioStartTime?: number
  audioEndTime?: number
  subtitleFilename?: string
  subtitleStyle?: SubtitleStyle
  titleStyle?: TitleStyle
  borderStyle?: BorderStyle
  logoFilename?: string
  logoSize?: number
  logoX?: number
  logoY?: number
  replaceOriginal?: boolean
  audioOffset?: number
}) => {
  const { data } = await api.post('/preview', params)
  return { ...data, url: withMediaBase(data.url) } as { url: string; filename: string }
}
