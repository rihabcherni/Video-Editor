import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SubtitleEntry } from '../api/client'
import { createId } from '../utils/id'
import type { TitleLineLayout, TitleRect, TitleRenderLayout } from '../utils/titleLayout'

export interface VideoProject {
  id: string
  title: string
  duration: number
  url: string
  filename: string
  thumbnail?: string
}

export interface AudioTrack {
  id: string
  filename: string
  url: string
}

export interface SubtitleStyle {
  size: number
  color: string
  backgroundColor: string
}

export interface LogoAsset {
  id: string
  filename: string
  url: string
}

export interface CropSettings {
  top: number
  bottom: number
  left: number
  right: number
}

function areTitleLayoutsEqual(a: TitleRenderLayout | null, b: TitleRenderLayout | null) {
  if (a === b) return true
  if (!a || !b) return false
  if (
    a.wrappedText !== b.wrappedText
    || a.blockWidth !== b.blockWidth
    || a.blockHeight !== b.blockHeight
    || a.lineHeight !== b.lineHeight
    || a.lines.length !== b.lines.length
    || !areTitleRectsEqual(a.textBounds, b.textBounds)
    || !areTitleRectsEqual(a.backgroundBounds, b.backgroundBounds)
    || !areTitleRectsEqual(a.frameBounds, b.frameBounds)
  ) {
    return false
  }

  return a.lines.every((line, index) => areTitleLinesEqual(line, b.lines[index]))
}

function normalizeMetric(value: number) {
  return Number(value.toFixed(3))
}

function normalizeRect(rect: TitleRect): TitleRect {
  return {
    x: normalizeMetric(rect.x),
    y: normalizeMetric(rect.y),
    width: normalizeMetric(rect.width),
    height: normalizeMetric(rect.height),
  }
}

function normalizeTitleLine(line: TitleLineLayout): TitleLineLayout {
  return {
    ...line,
    drawX: normalizeMetric(line.drawX),
    baselineY: normalizeMetric(line.baselineY),
    visualLeft: normalizeMetric(line.visualLeft),
    visualTop: normalizeMetric(line.visualTop),
    visualWidth: normalizeMetric(line.visualWidth),
    visualHeight: normalizeMetric(line.visualHeight),
    ascent: normalizeMetric(line.ascent),
    descent: normalizeMetric(line.descent),
  }
}

function normalizeTitleLayout(layout: TitleRenderLayout): TitleRenderLayout {
  return {
    ...layout,
    textBounds: normalizeRect(layout.textBounds),
    backgroundBounds: normalizeRect(layout.backgroundBounds),
    frameBounds: normalizeRect(layout.frameBounds),
    blockWidth: normalizeMetric(layout.blockWidth),
    blockHeight: normalizeMetric(layout.blockHeight),
    lineHeight: normalizeMetric(layout.lineHeight),
    lines: layout.lines.map(normalizeTitleLine),
  }
}

function areTitleRectsEqual(a: TitleRect, b: TitleRect) {
  return a.x === b.x
    && a.y === b.y
    && a.width === b.width
    && a.height === b.height
}

function areTitleLinesEqual(a: TitleLineLayout, b: TitleLineLayout) {
  return a.text === b.text
    && a.drawX === b.drawX
    && a.baselineY === b.baselineY
    && a.visualLeft === b.visualLeft
    && a.visualTop === b.visualTop
    && a.visualWidth === b.visualWidth
    && a.visualHeight === b.visualHeight
    && a.ascent === b.ascent
    && a.descent === b.descent
}

export interface ActionToast {
  id: string
  message: string
}

export interface ActionHistoryEntry {
  id: string
  message: string
  completedAt?: string
}

export interface VideoSegment {
  id: string
  label: string
  start: number
  end: number
  outputFilename: string | null
  outputUrl: string | null
  isGenerating?: boolean
  kind?: 'cut' | 'merge'
}

export interface MediaAsset {
  id: string
  type: 'video' | 'audio'
  title: string
  filename: string
  url: string
  duration: number
  thumbnail?: string
}

export interface MontageClip {
  id: string
  video: VideoProject
  trimStart: number
  trimEnd: number
  timelineStart: number
  order: number
}

export interface MontageAudioClip {
  id: string
  audio: AudioTrack
  trimStart: number
  trimEnd: number
  duration: number
  offset: number
  order: number
}

export type TitlePosition =
  | 'top-left' | 'top' | 'top-right'
  | 'middle-left' | 'middle' | 'middle-right'
  | 'bottom-left' | 'bottom' | 'bottom-right'

interface EditorState {
  video: VideoProject | null
  setVideo: (v: VideoProject | null) => void
  videoSourceWidth: number
  videoSourceHeight: number
  setVideoSourceDimensions: (width: number, height: number) => void

  trimStart: number
  trimEnd: number
  setTrimStart: (t: number) => void
  setTrimEnd: (t: number) => void
  segments: VideoSegment[]
  segmentHistory: VideoSegment[]
  addSegment: (segment: Omit<VideoSegment, 'id' | 'outputFilename' | 'outputUrl'>) => string
  addSegmentHistoryEntry: (segment: Omit<VideoSegment, 'id'>) => string
  removeSegment: (id: string) => void
  clearSegments: () => void
  clearSegmentHistory: () => void
  reorderSegments: (activeId: string, overId: string) => void
  resetSegmentOutputs: () => void
  setSegmentOutput: (id: string, output: { filename: string; url: string }) => void
  setSegmentGenerating: (id: string, generating: boolean) => void
  setMergedVideo: (v: VideoProject) => void

  audioTrack: AudioTrack | null
  setAudioTrack: (a: AudioTrack | null) => void
  replaceOriginalAudio: boolean
  setReplaceOriginalAudio: (r: boolean) => void
  audioDuration: number
  setAudioDuration: (d: number) => void
  audioTrimStart: number
  audioTrimEnd: number
  setAudioTrimStart: (t: number) => void
  setAudioTrimEnd: (t: number) => void
  audioOffset: number
  setAudioOffset: (t: number) => void
  audioApplied: boolean
  setAudioApplied: (a: boolean) => void
  appliedReplaceOriginal: boolean
  appliedAudioTrimStart: number
  appliedAudioTrimEnd: number
  appliedAudioOffset: number
  setAppliedAudioSettings: (s: { replaceOriginal: boolean; trimStart: number; trimEnd: number; offset: number }) => void
  audioUrlInput: string
  setAudioUrlInput: (url: string) => void
  audioLoading: boolean
  setAudioLoading: (loading: boolean) => void
  audioError: string | null
  setAudioError: (error: string | null) => void
  videoUrlInput: string
  setVideoUrlInput: (url: string) => void
  videoLoading: boolean
  setVideoLoading: (loading: boolean) => void
  videoError: string | null
  setVideoError: (error: string | null) => void

  subtitles: SubtitleEntry[]
  setSubtitles: (s: SubtitleEntry[]) => void
  subtitleFilename: string | null
  setSubtitleFilename: (f: string | null) => void
  subtitleStyle: SubtitleStyle
  setSubtitleStyle: (s: SubtitleStyle) => void
  appliedSubtitleStyle: SubtitleStyle | null
  setAppliedSubtitleStyle: (s: SubtitleStyle | null) => void
  subtitleAppliedSignature: string | null
  setSubtitleAppliedSignature: (s: string | null) => void

  logoImage: LogoAsset | null
  setLogoImage: (l: LogoAsset | null) => void
  logoDraftImage: LogoAsset | null
  setLogoDraftImage: (l: LogoAsset | null) => void
  logoSize: number
  setLogoSize: (s: number) => void
  logoDraftSize: number
  setLogoDraftSize: (s: number) => void
  logoX: number | null
  logoY: number | null
  setLogoXY: (x: number | null, y: number | null) => void
  logoDraftX: number | null
  logoDraftY: number | null
  setLogoDraftXY: (x: number | null, y: number | null) => void
  isApplyingLogo: boolean
  setIsApplyingLogo: (v: boolean) => void

  titleText: string
  setTitleText: (t: string) => void
  titleDraftText: string
  setTitleDraftText: (t: string) => void
  titleFont: string
  setTitleFont: (f: string) => void
  titleDraftFont: string
  setTitleDraftFont: (f: string) => void
  titleSize: number
  setTitleSize: (s: number) => void
  titleDraftSize: number
  setTitleDraftSize: (s: number) => void
  titleColor: string
  setTitleColor: (c: string) => void
  titleDraftColor: string
  setTitleDraftColor: (c: string) => void
  titleBgColor: string
  setTitleBgColor: (c: string) => void
  titleDraftBgColor: string
  setTitleDraftBgColor: (c: string) => void
  titleBorderColor: string
  setTitleBorderColor: (c: string) => void
  titleDraftBorderColor: string
  setTitleDraftBorderColor: (c: string) => void
  titleBorderWidth: number
  setTitleBorderWidth: (s: number) => void
  titleDraftBorderWidth: number
  setTitleDraftBorderWidth: (s: number) => void
  titleFrameColor: string
  setTitleFrameColor: (c: string) => void
  titleDraftFrameColor: string
  setTitleDraftFrameColor: (c: string) => void
  titleFrameWidth: number
  setTitleFrameWidth: (s: number) => void
  titleDraftFrameWidth: number
  setTitleDraftFrameWidth: (s: number) => void
  titlePadding: number
  setTitlePadding: (s: number) => void
  titleDraftPadding: number
  setTitleDraftPadding: (s: number) => void
  titleLineSpacing: number
  setTitleLineSpacing: (s: number) => void
  titleDraftLineSpacing: number
  setTitleDraftLineSpacing: (s: number) => void
  titleX: number | null
  titleY: number | null
  setTitleXY: (x: number | null, y: number | null) => void
  titleDraftX: number | null
  titleDraftY: number | null
  setTitleDraftXY: (x: number | null, y: number | null) => void
  titleAlign: 'left' | 'center' | 'right'
  setTitleAlign: (a: 'left' | 'center' | 'right') => void
  titleDraftAlign: 'left' | 'center' | 'right'
  setTitleDraftAlign: (a: 'left' | 'center' | 'right') => void
  titleRenderLayout: TitleRenderLayout | null
  setTitleRenderLayout: (layout: TitleRenderLayout | null) => void
  isApplyingTitle: boolean
  setIsApplyingTitle: (v: boolean) => void

  borderEnabled: boolean
  setBorderEnabled: (e: boolean) => void
  borderWidth: number
  setBorderWidth: (s: number) => void
  borderHeight: number
  setBorderHeight: (s: number) => void
  borderColor: string
  setBorderColor: (c: string) => void
  borderMode: 'outside'
  setBorderMode: (m: 'outside') => void

  borderDraftEnabled: boolean
  setBorderDraftEnabled: (e: boolean) => void
  borderDraftWidth: number
  setBorderDraftWidth: (s: number) => void
  borderDraftHeight: number
  setBorderDraftHeight: (s: number) => void
  borderDraftColor: string
  setBorderDraftColor: (c: string) => void
  borderDraftMode: 'outside'
  setBorderDraftMode: (m: 'outside') => void

  cropEnabled: boolean
  setCropEnabled: (enabled: boolean) => void
  cropDraftEnabled: boolean
  setCropDraftEnabled: (enabled: boolean) => void
  crop: CropSettings
  cropDraft: CropSettings
  setCropDraftTop: (n: number) => void
  setCropDraftBottom: (n: number) => void
  setCropDraftLeft: (n: number) => void
  setCropDraftRight: (n: number) => void
  setCrop: (crop: CropSettings) => void
  resetCrop: () => void
  resetCropDraft: () => void
  applyCropDraft: () => void

  exportQuality: '480p' | '720p' | '1080p'
  setExportQuality: (q: '480p' | '720p' | '1080p') => void
  exportAspectRatio: 'original' | '16:9' | '9:16' | '1:1' | '4:5' | '5:4' | '4:3' | '3:2'
  setExportAspectRatio: (r: 'original' | '16:9' | '9:16' | '1:1' | '4:5' | '5:4' | '4:3' | '3:2') => void
  exportFilename: string
  setExportFilename: (name: string) => void

  activeTab: 'import' | 'montage' | 'crop' | 'subtitles' | 'logo' | 'title' | 'border' | 'export'
  setActiveTab: (t: 'import' | 'montage' | 'crop' | 'subtitles' | 'logo' | 'title' | 'border' | 'export') => void
  isProcessing: boolean
  setIsProcessing: (p: boolean) => void
  processedUrl: string | null
  setProcessedUrl: (u: string | null) => void
  editStatus: string | null
  setEditStatus: (s: string | null) => void
  previewLoading: boolean
  setPreviewLoading: (p: boolean) => void
  pendingPreviewAction: string | null
  setPendingPreviewAction: (message: string | null) => void
  actionToasts: ActionToast[]
  actionHistory: ActionHistoryEntry[]
  pushActionToast: (message: string) => void
  removeActionToast: (id: string) => void

  seekTo: number | null
  setSeekTo: (t: number | null) => void

  // Montage multi-clip state
  montageClips: MontageClip[]
  addMontageClip: (video: VideoProject, duration: number) => void
  removeMontageClip: (id: string) => void
  reorderMontageClips: (activeId: string, overId: string, placement?: 'before' | 'after') => void
  reorderMontageAudioClips: (activeId: string, overId: string, placement?: 'before' | 'after') => void
  updateMontageClipTrim: (id: string, trimStart: number, trimEnd: number) => void
  updateMontageClip: (id: string, updates: Partial<Omit<MontageClip, 'id' | 'video'>>) => void
  splitMontageClip: (id: string, splitTime: number) => void
  clearMontageClips: () => void
  montageAudioClips: MontageAudioClip[]
  addMontageAudioClip: (audio: AudioTrack, duration: number) => void
  removeMontageAudioClip: (id: string) => void
  updateMontageAudioClip: (id: string, updates: Partial<Omit<MontageAudioClip, 'id'>>) => void
  splitMontageAudioClip: (id: string, splitTime: number) => void
  clearMontageAudioClips: () => void
  mergeLoading: boolean
  setMergeLoading: (v: boolean) => void
  mergeStatus: string | null
  setMergeStatus: (s: string | null) => void

  // Unified Canva-style media library pool
  mediaAssets: MediaAsset[]
  addMediaAsset: (asset: MediaAsset) => void
  removeMediaAsset: (id: string) => void
  clearMediaAssets: () => void

  reset: () => void
}

type PersistedEditorState = Pick<EditorState,
  | 'video'
  | 'trimStart'
  | 'trimEnd'
  | 'segments'
  | 'segmentHistory'
  | 'audioTrack'
  | 'replaceOriginalAudio'
  | 'audioDuration'
  | 'audioTrimStart'
  | 'audioTrimEnd'
  | 'audioOffset'
  | 'audioApplied'
  | 'appliedReplaceOriginal'
  | 'appliedAudioTrimStart'
  | 'appliedAudioTrimEnd'
  | 'appliedAudioOffset'
  | 'subtitles'
  | 'subtitleFilename'
  | 'subtitleStyle'
  | 'appliedSubtitleStyle'
  | 'subtitleAppliedSignature'
  | 'logoImage'
  | 'logoDraftImage'
  | 'logoSize'
  | 'logoDraftSize'
  | 'logoX'
  | 'logoY'
  | 'logoDraftX'
  | 'logoDraftY'
  | 'titleText'
  | 'titleDraftText'
  | 'titleFont'
  | 'titleDraftFont'
  | 'titleSize'
  | 'titleDraftSize'
  | 'titleColor'
  | 'titleDraftColor'
  | 'titleBgColor'
  | 'titleDraftBgColor'
  | 'titleBorderColor'
  | 'titleDraftBorderColor'
  | 'titleBorderWidth'
  | 'titleDraftBorderWidth'
  | 'titleFrameColor'
  | 'titleDraftFrameColor'
  | 'titleFrameWidth'
  | 'titleDraftFrameWidth'
  | 'titlePadding'
  | 'titleDraftPadding'
  | 'titleLineSpacing'
  | 'titleDraftLineSpacing'
  | 'titleX'
  | 'titleY'
  | 'titleDraftX'
  | 'titleDraftY'
  | 'titleAlign'
  | 'titleDraftAlign'
  | 'borderEnabled'
  | 'borderWidth'
  | 'borderHeight'
  | 'borderColor'
  | 'borderMode'
  | 'borderDraftEnabled'
  | 'borderDraftWidth'
  | 'borderDraftHeight'
  | 'borderDraftColor'
  | 'borderDraftMode'
  | 'cropEnabled'
  | 'cropDraftEnabled'
  | 'crop'
  | 'cropDraft'
  | 'exportQuality'
  | 'exportAspectRatio'
  | 'exportFilename'
  | 'activeTab'
  | 'processedUrl'
  | 'actionHistory'
  | 'montageClips'
  | 'montageAudioClips'
  | 'mediaAssets'
>

const defaultSubtitleSize = Number(import.meta.env.VITE_SUBTITLE_DEFAULT_SIZE || 22)
const defaultSubtitleColor = import.meta.env.VITE_SUBTITLE_DEFAULT_COLOR || '#ffffff'
const defaultSubtitleBackgroundColor = import.meta.env.VITE_SUBTITLE_DEFAULT_BG || '#000000'
const defaultLogoSize = Number(import.meta.env.VITE_LOGO_DEFAULT_SIZE || 15)
const defaultTitleFont = import.meta.env.VITE_TITLE_DEFAULT_FONT || 'Arial'
const defaultTitleSize = Number(import.meta.env.VITE_TITLE_DEFAULT_SIZE || 42)
const defaultTitleColor = import.meta.env.VITE_TITLE_DEFAULT_COLOR || '#ffffff'
const defaultTitleBgColor = import.meta.env.VITE_TITLE_DEFAULT_BG || '#000000'
const defaultTitleBorderColor = import.meta.env.VITE_TITLE_DEFAULT_BORDER_COLOR || '#000000'
const defaultTitleBorderWidth = Number(import.meta.env.VITE_TITLE_DEFAULT_BORDER_WIDTH || 0)
const defaultTitleFrameColor = import.meta.env.VITE_TITLE_DEFAULT_FRAME_COLOR || '#000000'
const defaultTitleFrameWidth = Number(import.meta.env.VITE_TITLE_DEFAULT_FRAME_WIDTH || 0)
const defaultTitlePadding = Number(import.meta.env.VITE_TITLE_DEFAULT_PADDING || 8)
const defaultTitleLineSpacing = Number(import.meta.env.VITE_TITLE_DEFAULT_LINE_SPACING || 0)
const defaultTitleAlign = (import.meta.env.VITE_TITLE_DEFAULT_ALIGN || 'center') as 'left' | 'center' | 'right'
const defaultBorderSize = Number(import.meta.env.VITE_BORDER_DEFAULT_SIZE || 0)
const defaultBorderColor = import.meta.env.VITE_BORDER_DEFAULT_COLOR || '#ffffff'
const defaultCrop: CropSettings = { top: 0, bottom: 0, left: 0, right: 0 }

export const useStore = create<EditorState>()(persist((set) => ({
  video: null,
  setVideo: v => set(state => {
    const isReplacingVideo = !!state.video && state.video.id !== v?.id

    return {
      video: v,
      videoSourceWidth: 0,
      videoSourceHeight: 0,
      trimStart: 0,
      trimEnd: v?.duration || 0,
      cropEnabled: false,
      cropDraftEnabled: false,
      crop: defaultCrop,
      cropDraft: defaultCrop,
      processedUrl: null,
      segments: [],
      segmentHistory: [],
      editStatus: null,
      previewLoading: false,
      pendingPreviewAction: null,
      actionToasts: [],
      actionHistory: [],
      seekTo: null,
      exportFilename: '',
      appliedSubtitleStyle: null,
      subtitleAppliedSignature: null,
      ...(isReplacingVideo
        ? {
          audioApplied: false,
          appliedReplaceOriginal: false,
          appliedAudioTrimStart: 0,
          appliedAudioTrimEnd: 0,
          appliedAudioOffset: 0,
          subtitles: [],
          subtitleFilename: null,
          appliedSubtitleStyle: null,
          logoImage: null,
          logoDraftImage: null,
          logoX: null,
          logoY: null,
          logoDraftX: null,
          logoDraftY: null,
          titleText: '',
          titleDraftText: '',
          titleDraftFont: defaultTitleFont,
          titleDraftSize: defaultTitleSize,
          titleDraftColor: defaultTitleColor,
          titleDraftBgColor: defaultTitleBgColor,
          titleDraftBorderColor: defaultTitleBorderColor,
          titleDraftBorderWidth: defaultTitleBorderWidth,
          titleDraftFrameColor: defaultTitleFrameColor,
          titleDraftFrameWidth: defaultTitleFrameWidth,
          titleDraftPadding: defaultTitlePadding,
          titleLineSpacing: defaultTitleLineSpacing,
          titleDraftLineSpacing: defaultTitleLineSpacing,
          titleX: null,
          titleY: null,
          titleDraftX: null,
          titleDraftY: null,
          titleAlign: defaultTitleAlign,
          titleDraftAlign: defaultTitleAlign,
          titleRenderLayout: null,
          isApplyingLogo: false,
          isApplyingTitle: false,
        }
        : {}),
    }
  }),

  trimStart: 0,
  trimEnd: 0,
  videoSourceWidth: 0,
  videoSourceHeight: 0,
  setVideoSourceDimensions: (width, height) => set({
    videoSourceWidth: Math.max(0, Math.round(width)),
    videoSourceHeight: Math.max(0, Math.round(height)),
  }),
  setTrimStart: t => set({ trimStart: t }),
  setTrimEnd: t => set({ trimEnd: t }),
  segments: [],
  addSegment: segment => {
    const id = createId()
    set(state => ({
      segments: [
        ...state.segments,
        {
          ...segment,
          id,
          outputFilename: null,
          outputUrl: null,
          isGenerating: false,
          kind: segment.kind || 'cut',
        },
      ],
      segmentHistory: [
        ...state.segmentHistory,
        {
          ...segment,
          id,
          outputFilename: null,
          outputUrl: null,
          isGenerating: false,
          kind: segment.kind || 'cut',
        },
      ],
    }))
    return id
  },
  segmentHistory: [],
  addSegmentHistoryEntry: segment => {
    const id = createId()
    set(state => ({
      segmentHistory: [
        ...state.segmentHistory,
        {
          ...segment,
          id,
        },
      ],
    }))
    return id
  },
  removeSegment: id => set(state => ({ segments: state.segments.filter(segment => segment.id !== id) })),
  clearSegments: () => set({ segments: [] }),
  clearSegmentHistory: () => set({ segmentHistory: [] }),
  reorderSegments: (activeId, overId) => set(state => {
    if (activeId === overId) return state
    const fromIndex = state.segments.findIndex(segment => segment.id === activeId)
    const toIndex = state.segments.findIndex(segment => segment.id === overId)
    if (fromIndex < 0 || toIndex < 0) return state
    const next = [...state.segments]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    return { segments: next }
  }),
  resetSegmentOutputs: () => set(state => ({
    segments: state.segments.map(segment => ({
      ...segment,
      outputFilename: null,
      outputUrl: null,
    })),
    segmentHistory: state.segmentHistory.map(segment => ({
      ...segment,
      outputFilename: null,
      outputUrl: null,
    })),
  })),
  setSegmentOutput: (id, output) => set(state => ({
    segments: state.segments.map(segment => segment.id === id
      ? { ...segment, outputFilename: output.filename, outputUrl: output.url, isGenerating: false }
      : segment),
    segmentHistory: state.segmentHistory.map(segment => segment.id === id
      ? { ...segment, outputFilename: output.filename, outputUrl: output.url, isGenerating: false }
      : segment),
  })),
  setSegmentGenerating: (id, generating) => set(state => ({
    segments: state.segments.map(segment => segment.id === id
      ? { ...segment, isGenerating: generating }
      : segment),
    segmentHistory: state.segmentHistory.map(segment => segment.id === id
      ? { ...segment, isGenerating: generating }
      : segment),
  })),
  setMergedVideo: v => set(() => ({
    video: v,
    videoSourceWidth: 0,
    videoSourceHeight: 0,
    trimStart: 0,
    trimEnd: v.duration || 0,
    cropEnabled: false,
    cropDraftEnabled: false,
    crop: defaultCrop,
    cropDraft: defaultCrop,
    processedUrl: null,
    segments: [],
    editStatus: null,
    previewLoading: false,
    pendingPreviewAction: null,
    actionToasts: [],
    seekTo: null,
    exportFilename: '',
    appliedSubtitleStyle: null,
    subtitleAppliedSignature: null,
    titleRenderLayout: null,
  })),

  audioTrack: null,
  setAudioTrack: a => set({
    audioTrack: a,
    audioDuration: a ? 0 : 0,
    audioTrimStart: 0,
    audioTrimEnd: 0,
    audioOffset: 0,
    audioApplied: false,
    appliedReplaceOriginal: false,
    appliedAudioTrimStart: 0,
    appliedAudioTrimEnd: 0,
    appliedAudioOffset: 0,
  }),
  replaceOriginalAudio: false,
  setReplaceOriginalAudio: r => set({ replaceOriginalAudio: r }),
  audioDuration: 0,
  setAudioDuration: d => set({ audioDuration: d }),
  audioTrimStart: 0,
  audioTrimEnd: 0,
  setAudioTrimStart: t => set({ audioTrimStart: t }),
  setAudioTrimEnd: t => set({ audioTrimEnd: t }),
  audioOffset: 0,
  setAudioOffset: t => set({ audioOffset: t }),
  audioApplied: false,
  setAudioApplied: a => set({ audioApplied: a }),
  appliedReplaceOriginal: false,
  appliedAudioTrimStart: 0,
  appliedAudioTrimEnd: 0,
  appliedAudioOffset: 0,
  setAppliedAudioSettings: s => set({
    appliedReplaceOriginal: s.replaceOriginal,
    appliedAudioTrimStart: s.trimStart,
    appliedAudioTrimEnd: s.trimEnd,
    appliedAudioOffset: s.offset,
    audioApplied: true,
  }),
  audioUrlInput: '',
  setAudioUrlInput: url => set({ audioUrlInput: url }),
  audioLoading: false,
  setAudioLoading: loading => set({ audioLoading: loading }),
  audioError: null,
  setAudioError: error => set({ audioError: error }),
  videoUrlInput: '',
  setVideoUrlInput: url => set({ videoUrlInput: url }),
  videoLoading: false,
  setVideoLoading: loading => set({ videoLoading: loading }),
  videoError: null,
  setVideoError: error => set({ videoError: error }),

  subtitles: [],
  setSubtitles: s => set({ subtitles: s }),
  subtitleFilename: null,
  setSubtitleFilename: f => set({ subtitleFilename: f }),
  subtitleStyle: {
    size: defaultSubtitleSize,
    color: defaultSubtitleColor,
    backgroundColor: defaultSubtitleBackgroundColor,
  },
  setSubtitleStyle: s => set({ subtitleStyle: s }),
  appliedSubtitleStyle: null,
  setAppliedSubtitleStyle: s => set({ appliedSubtitleStyle: s }),
  subtitleAppliedSignature: null,
  setSubtitleAppliedSignature: s => set({ subtitleAppliedSignature: s }),

  logoImage: null,
  setLogoImage: l => set({ logoImage: l }),
  logoDraftImage: null,
  setLogoDraftImage: l => set({ logoDraftImage: l }),
  logoSize: defaultLogoSize,
  setLogoSize: s => set({ logoSize: s }),
  logoDraftSize: defaultLogoSize,
  setLogoDraftSize: s => set({ logoDraftSize: s }),
  logoX: null,
  logoY: null,
  setLogoXY: (x, y) => set({ logoX: x, logoY: y }),
  logoDraftX: null,
  logoDraftY: null,
  setLogoDraftXY: (x, y) => set({ logoDraftX: x, logoDraftY: y }),
  isApplyingLogo: false,
  setIsApplyingLogo: v => set({ isApplyingLogo: v }),

  titleText: '',
  setTitleText: t => set({ titleText: t }),
  titleDraftText: '',
  setTitleDraftText: t => set({ titleDraftText: t }),
  titleFont: defaultTitleFont,
  setTitleFont: f => set({ titleFont: f }),
  titleDraftFont: defaultTitleFont,
  setTitleDraftFont: f => set({ titleDraftFont: f }),
  titleSize: defaultTitleSize,
  setTitleSize: s => set({ titleSize: s }),
  titleDraftSize: defaultTitleSize,
  setTitleDraftSize: s => set({ titleDraftSize: s }),
  titleColor: defaultTitleColor,
  setTitleColor: c => set({ titleColor: c }),
  titleDraftColor: defaultTitleColor,
  setTitleDraftColor: c => set({ titleDraftColor: c }),
  titleBgColor: defaultTitleBgColor,
  setTitleBgColor: c => set({ titleBgColor: c }),
  titleDraftBgColor: defaultTitleBgColor,
  setTitleDraftBgColor: c => set({ titleDraftBgColor: c }),
  titleBorderColor: defaultTitleBorderColor,
  setTitleBorderColor: c => set({ titleBorderColor: c }),
  titleDraftBorderColor: defaultTitleBorderColor,
  setTitleDraftBorderColor: c => set({ titleDraftBorderColor: c }),
  titleBorderWidth: defaultTitleBorderWidth,
  setTitleBorderWidth: s => set({ titleBorderWidth: s }),
  titleDraftBorderWidth: defaultTitleBorderWidth,
  setTitleDraftBorderWidth: s => set({ titleDraftBorderWidth: s }),
  titleFrameColor: defaultTitleFrameColor,
  setTitleFrameColor: c => set({ titleFrameColor: c }),
  titleDraftFrameColor: defaultTitleFrameColor,
  setTitleDraftFrameColor: c => set({ titleDraftFrameColor: c }),
  titleFrameWidth: defaultTitleFrameWidth,
  setTitleFrameWidth: s => set({ titleFrameWidth: s }),
  titleDraftFrameWidth: defaultTitleFrameWidth,
  setTitleDraftFrameWidth: s => set({ titleDraftFrameWidth: s }),
  titlePadding: defaultTitlePadding,
  setTitlePadding: s => set({ titlePadding: s }),
  titleDraftPadding: defaultTitlePadding,
  setTitleDraftPadding: s => set({ titleDraftPadding: s }),
  titleLineSpacing: defaultTitleLineSpacing,
  setTitleLineSpacing: s => set({ titleLineSpacing: s }),
  titleDraftLineSpacing: defaultTitleLineSpacing,
  setTitleDraftLineSpacing: s => set({ titleDraftLineSpacing: s }),
  titleX: null,
  titleY: null,
  setTitleXY: (x, y) => set({ titleX: x, titleY: y }),
  titleDraftX: null,
  titleDraftY: null,
  setTitleDraftXY: (x, y) => set({ titleDraftX: x, titleDraftY: y }),
  titleAlign: defaultTitleAlign,
  setTitleAlign: a => set({ titleAlign: a }),
  titleDraftAlign: defaultTitleAlign,
  setTitleDraftAlign: a => set({ titleDraftAlign: a }),
  titleRenderLayout: null,
  setTitleRenderLayout: layout => set(state => (
    areTitleLayoutsEqual(state.titleRenderLayout, layout ? normalizeTitleLayout(layout) : null)
      ? state
      : {
        titleRenderLayout: layout ? normalizeTitleLayout(layout) : null,
      }
  )),
  isApplyingTitle: false,
  setIsApplyingTitle: v => set({ isApplyingTitle: v }),

  borderEnabled: defaultBorderSize > 0,
  setBorderEnabled: e => set({ borderEnabled: e }),
  borderWidth: defaultBorderSize,
  setBorderWidth: s => set({ borderWidth: s }),
  borderHeight: defaultBorderSize,
  setBorderHeight: s => set({ borderHeight: s }),
  borderColor: defaultBorderColor,
  setBorderColor: c => set({ borderColor: c }),
  borderMode: 'outside',
  setBorderMode: m => set({ borderMode: m }),

  borderDraftEnabled: defaultBorderSize > 0,
  setBorderDraftEnabled: e => set({ borderDraftEnabled: e }),
  borderDraftWidth: defaultBorderSize,
  setBorderDraftWidth: s => set({ borderDraftWidth: s }),
  borderDraftHeight: defaultBorderSize,
  setBorderDraftHeight: s => set({ borderDraftHeight: s }),
  borderDraftColor: defaultBorderColor,
  setBorderDraftColor: c => set({ borderDraftColor: c }),
  borderDraftMode: 'outside',
  setBorderDraftMode: m => set({ borderDraftMode: m }),

  cropEnabled: false,
  setCropEnabled: enabled => set({ cropEnabled: enabled }),
  cropDraftEnabled: false,
  setCropDraftEnabled: enabled => set({ cropDraftEnabled: enabled }),
  crop: defaultCrop,
  cropDraft: defaultCrop,
  setCropDraftTop: n => set(state => ({ cropDraft: { ...state.cropDraft, top: n } })),
  setCropDraftBottom: n => set(state => ({ cropDraft: { ...state.cropDraft, bottom: n } })),
  setCropDraftLeft: n => set(state => ({ cropDraft: { ...state.cropDraft, left: n } })),
  setCropDraftRight: n => set(state => ({ cropDraft: { ...state.cropDraft, right: n } })),
  setCrop: crop => set({ crop, cropDraft: crop }),
  resetCrop: () => set({ cropEnabled: false, cropDraftEnabled: false, crop: defaultCrop, cropDraft: defaultCrop }),
  resetCropDraft: () => set({ cropDraftEnabled: false, cropDraft: defaultCrop }),
  applyCropDraft: () => set(state => ({
    cropEnabled: state.cropDraftEnabled,
    crop: state.cropDraft,
    cropDraft: state.cropDraft,
  })),

  exportQuality: '720p',
  setExportQuality: q => set({ exportQuality: q }),
  exportAspectRatio: 'original',
  setExportAspectRatio: r => set({ exportAspectRatio: r }),
  exportFilename: '',
  setExportFilename: name => set({ exportFilename: name }),

  activeTab: 'import',
  setActiveTab: t => set({ activeTab: t }),
  isProcessing: false,
  setIsProcessing: p => set({ isProcessing: p }),
  processedUrl: null,
  setProcessedUrl: u => set({ processedUrl: u }),
  editStatus: null,
  setEditStatus: s => set({ editStatus: s }),
  previewLoading: false,
  setPreviewLoading: p => set({ previewLoading: p }),
  pendingPreviewAction: null,
  setPendingPreviewAction: message => set({ pendingPreviewAction: message }),
  actionToasts: [],
  actionHistory: [],
  pushActionToast: message => set(state => ({
    actionToasts: [...state.actionToasts, { id: createId(), message }].slice(-4),
    actionHistory: [...state.actionHistory, { id: createId(), message, completedAt: new Date().toISOString() }].slice(-6),
  })),
  removeActionToast: id => set(state => ({
    actionToasts: state.actionToasts.filter(toast => toast.id !== id),
  })),

  reset: () => set({
    video: null, videoSourceWidth: 0, videoSourceHeight: 0, trimStart: 0, trimEnd: 0,
    segments: [],
    audioTrack: null, replaceOriginalAudio: false, audioDuration: 0, audioTrimStart: 0, audioTrimEnd: 0, audioOffset: 0,
    audioApplied: false, appliedReplaceOriginal: false, appliedAudioTrimStart: 0, appliedAudioTrimEnd: 0, appliedAudioOffset: 0,
    subtitles: [], subtitleFilename: null,
    subtitleStyle: {
      size: defaultSubtitleSize,
      color: defaultSubtitleColor,
      backgroundColor: defaultSubtitleBackgroundColor,
    },
    appliedSubtitleStyle: null,
    subtitleAppliedSignature: null,
    logoImage: null,
    logoDraftImage: null,
    logoSize: defaultLogoSize,
    logoDraftSize: defaultLogoSize,
    logoX: null,
    logoY: null,
    logoDraftX: null,
    logoDraftY: null,
    isApplyingLogo: false,
    titleText: '',
    titleDraftText: '',
    titleFont: defaultTitleFont,
    titleDraftFont: defaultTitleFont,
    titleSize: defaultTitleSize,
    titleDraftSize: defaultTitleSize,
    titleColor: defaultTitleColor,
    titleDraftColor: defaultTitleColor,
    titleBgColor: defaultTitleBgColor,
    titleDraftBgColor: defaultTitleBgColor,
    titleBorderColor: defaultTitleBorderColor,
    titleDraftBorderColor: defaultTitleBorderColor,
    titleBorderWidth: defaultTitleBorderWidth,
    titleDraftBorderWidth: defaultTitleBorderWidth,
    titleFrameColor: defaultTitleFrameColor,
    titleDraftFrameColor: defaultTitleFrameColor,
    titleFrameWidth: defaultTitleFrameWidth,
    titleDraftFrameWidth: defaultTitleFrameWidth,
    titlePadding: defaultTitlePadding,
    titleDraftPadding: defaultTitlePadding,
    titleLineSpacing: defaultTitleLineSpacing,
    titleDraftLineSpacing: defaultTitleLineSpacing,
    titleX: null,
    titleY: null,
    titleDraftX: null,
    titleDraftY: null,
    titleAlign: defaultTitleAlign,
    titleDraftAlign: defaultTitleAlign,
    titleRenderLayout: null,
    isApplyingTitle: false,
    borderEnabled: defaultBorderSize > 0,
    borderWidth: defaultBorderSize,
    borderHeight: defaultBorderSize,
    borderColor: defaultBorderColor,
    borderMode: 'outside',
    borderDraftEnabled: defaultBorderSize > 0,
    borderDraftWidth: defaultBorderSize,
    borderDraftHeight: defaultBorderSize,
    borderDraftColor: defaultBorderColor,
    borderDraftMode: 'outside',
    cropEnabled: false,
    cropDraftEnabled: false,
    crop: defaultCrop,
    cropDraft: defaultCrop,
    exportQuality: '720p',
    exportAspectRatio: 'original',
    exportFilename: '',
    processedUrl: null, activeTab: 'import', editStatus: null,
    previewLoading: false,
    pendingPreviewAction: null,
    actionToasts: [],
    actionHistory: [],
    segmentHistory: [],
    seekTo: null,
  }),

  seekTo: null,
  setSeekTo: t => set({ seekTo: t }),

  // Montage clip actions
  montageClips: [],
  addMontageClip: (video) => set(state => {
    const order = state.montageClips.length
    const timelineStart = state.montageClips.reduce(
      (max, clip) => Math.max(max, (clip.timelineStart ?? clip.order ?? 0) + Math.max(0, clip.trimEnd - clip.trimStart)),
      0,
    )
    return {
      montageClips: [
        ...state.montageClips,
        { id: createId(), video, trimStart: 0, trimEnd: video.duration, timelineStart, order },
      ],
    }
  }),
  removeMontageClip: id => set(state => ({
    montageClips: state.montageClips
      .filter(c => c.id !== id)
      .map((c, i) => ({ ...c, order: i })),
  })),
  reorderMontageClips: (activeId, overId, placement = 'before') => set(state => {
    const clips = [...state.montageClips].sort((a, b) => a.order - b.order)
    const activeIndex = clips.findIndex(c => c.id === activeId)
    const overIndex = clips.findIndex(c => c.id === overId)
    if (activeIndex === -1 || overIndex === -1) return {}
    const [removed] = clips.splice(activeIndex, 1)
    const insertIndex = placement === 'after' ? overIndex : overIndex
    clips.splice(insertIndex, 0, removed)

    let cursor = 0
    const reordered = clips.map((clip, index) => {
      const duration = Math.max(0, clip.trimEnd - clip.trimStart)
      const timelineStart = cursor
      cursor += duration
      return { ...clip, order: index, timelineStart }
    })

    return { montageClips: reordered }
  }),
  updateMontageClipTrim: (id, trimStart, trimEnd) => set(state => ({
    montageClips: state.montageClips.map(c =>
      c.id === id ? { ...c, trimStart, trimEnd } : c
    ),
  })),
  updateMontageClip: (id, updates) => set(state => ({
    montageClips: state.montageClips.map(c =>
      c.id === id ? { ...c, ...updates } : c
    ),
  })),
  splitMontageClip: (id, splitTime) => set(state => {
    const clipIndex = state.montageClips.findIndex(c => c.id === id)
    if (clipIndex === -1) return {}
    const clip = state.montageClips[clipIndex]
    const clipStart = clip.timelineStart || clip.order || 0
    const clipDuration = clip.trimEnd - clip.trimStart
    const splitPointWithinClip = splitTime - clipStart
    
    if (splitPointWithinClip <= 0.1 || splitPointWithinClip >= clipDuration - 0.1) {
      return {}
    }
    
    const firstPart = {
      ...clip,
      id: createId(),
      trimEnd: clip.trimStart + splitPointWithinClip,
      order: clip.order,
    }
    
    const secondPart = {
      ...clip,
      id: createId(),
      trimStart: clip.trimStart + splitPointWithinClip,
      timelineStart: clipStart + splitPointWithinClip,
      order: clip.order + 0.5,
    }
    
    const newClips = [...state.montageClips]
    newClips.splice(clipIndex, 1, firstPart, secondPart)
    
    return {
      montageClips: newClips.map((c, i) => ({ ...c, order: i, timelineStart: c.timelineStart || i })),
    }
  }),
  clearMontageClips: () => set({ montageClips: [] }),

  montageAudioClips: [],
  addMontageAudioClip: (audio, duration) => set(state => {
    const order = state.montageAudioClips.length
    const offset = state.montageAudioClips.reduce((max, clip) => {
      const clipDuration = Math.max(0, clip.trimEnd - clip.trimStart)
      return Math.max(max, clip.offset + clipDuration)
    }, 0)

    return {
      montageAudioClips: [
        ...state.montageAudioClips,
        { id: createId(), audio, trimStart: 0, trimEnd: duration, duration, offset, order },
      ],
    }
  }),
  removeMontageAudioClip: id => set(state => ({
    montageAudioClips: state.montageAudioClips.filter(c => c.id !== id).map((c, i) => ({ ...c, order: i })),
  })),
  reorderMontageAudioClips: (activeId, overId, placement = 'before') => set(state => {
    const clips = [...state.montageAudioClips].sort((a, b) => a.order - b.order)
    const activeIndex = clips.findIndex(c => c.id === activeId)
    const overIndex = clips.findIndex(c => c.id === overId)
    if (activeIndex === -1 || overIndex === -1) return {}
    const [removed] = clips.splice(activeIndex, 1)
    const insertIndex = placement === 'after' ? overIndex + 1 : overIndex
    clips.splice(insertIndex, 0, removed)

    let cursor = 0
    const reordered = clips.map((clip, index) => {
      const duration = Math.max(0, clip.trimEnd - clip.trimStart)
      const offset = cursor
      cursor += duration
      return { ...clip, order: index, offset }
    })

    return { montageAudioClips: reordered }
  }),
  updateMontageAudioClip: (id, updates) => set(state => ({
    montageAudioClips: state.montageAudioClips.map(c =>
      c.id === id ? { ...c, ...updates } : c
    ),
  })),
  splitMontageAudioClip: (id, splitTime) => set(state => {
    const clipIndex = state.montageAudioClips.findIndex(c => c.id === id)
    if (clipIndex === -1) return {}
    const clip = state.montageAudioClips[clipIndex]
    const clipDuration = clip.trimEnd - clip.trimStart
    const splitPointWithinClip = splitTime - clip.offset
    
    if (splitPointWithinClip <= 0.1 || splitPointWithinClip >= clipDuration - 0.1) {
      return {}
    }
    
    const firstPart = {
      ...clip,
      id: createId(),
      trimEnd: clip.trimStart + splitPointWithinClip,
      duration: splitPointWithinClip,
      order: clip.order,
    }
    
    const secondPart = {
      ...clip,
      id: createId(),
      trimStart: clip.trimStart + splitPointWithinClip,
      offset: clip.offset + splitPointWithinClip,
      duration: clipDuration - splitPointWithinClip,
      order: clip.order + 0.5,
    }
    
    const newClips = [...state.montageAudioClips]
    newClips.splice(clipIndex, 1, firstPart, secondPart)
    
    return {
      montageAudioClips: newClips.map((c, i) => ({ ...c, order: i })),
    }
  }),
  clearMontageAudioClips: () => set({ montageAudioClips: [] }),

  mergeLoading: false,
  setMergeLoading: v => set({ mergeLoading: v }),
  mergeStatus: null,
  setMergeStatus: s => set({ mergeStatus: s }),

  // Unified Media Assets Library
  mediaAssets: [],
  addMediaAsset: asset => set(state => {
    // Avoid duplicates if same filename/url
    if (state.mediaAssets.some(a => a.url === asset.url || a.filename === asset.filename)) {
      return {}
    }
    return { mediaAssets: [...state.mediaAssets, asset] }
  }),
  removeMediaAsset: id => set(state => {
    const removedAsset = state.mediaAssets.find(asset => asset.id === id)
    if (!removedAsset) {
      return { mediaAssets: state.mediaAssets }
    }

    const nextMediaAssets = state.mediaAssets.filter(asset => asset.id !== id)
    const shouldRemoveMontageClip = (clip: MontageClip) => clip.video.filename !== removedAsset.filename && clip.video.url !== removedAsset.url
    const shouldRemoveMontageAudioClip = (clip: MontageAudioClip) => clip.audio.filename !== removedAsset.filename && clip.audio.url !== removedAsset.url

    return {
      mediaAssets: nextMediaAssets,
      montageClips: state.montageClips.filter(shouldRemoveMontageClip).map((clip, index) => ({ ...clip, order: index })),
      montageAudioClips: state.montageAudioClips.filter(shouldRemoveMontageAudioClip).map((clip, index) => ({ ...clip, order: index })),
    }
  }),
  clearMediaAssets: () => set(state => {
    const remainingAssets = state.mediaAssets
    const removeReferencedMontageClips = (clip: MontageClip) => !remainingAssets.some(asset => asset.filename === clip.video.filename || asset.url === clip.video.url)
    const removeReferencedMontageAudioClips = (clip: MontageAudioClip) => !remainingAssets.some(asset => asset.filename === clip.audio.filename || asset.url === clip.audio.url)

    return {
      mediaAssets: [],
      montageClips: state.montageClips.filter(removeReferencedMontageClips).map((clip, index) => ({ ...clip, order: index })),
      montageAudioClips: state.montageAudioClips.filter(removeReferencedMontageAudioClips).map((clip, index) => ({ ...clip, order: index })),
    }
  }),
}), {
  name: 'video-editor-project',
  partialize: (state): PersistedEditorState => ({
    video: state.video,
    trimStart: state.trimStart,
    trimEnd: state.trimEnd,
    segments: state.segments,
    segmentHistory: state.segmentHistory,
    audioTrack: state.audioTrack,
    replaceOriginalAudio: state.replaceOriginalAudio,
    audioDuration: state.audioDuration,
    audioTrimStart: state.audioTrimStart,
    audioTrimEnd: state.audioTrimEnd,
    audioOffset: state.audioOffset,
    audioApplied: state.audioApplied,
    appliedReplaceOriginal: state.appliedReplaceOriginal,
    appliedAudioTrimStart: state.appliedAudioTrimStart,
    appliedAudioTrimEnd: state.appliedAudioTrimEnd,
    appliedAudioOffset: state.appliedAudioOffset,
    subtitles: state.subtitles,
    subtitleFilename: state.subtitleFilename,
    subtitleStyle: state.subtitleStyle,
    appliedSubtitleStyle: state.appliedSubtitleStyle,
    subtitleAppliedSignature: state.subtitleAppliedSignature,
    logoImage: state.logoImage,
    logoDraftImage: state.logoDraftImage,
    logoSize: state.logoSize,
    logoDraftSize: state.logoDraftSize,
    logoX: state.logoX,
    logoY: state.logoY,
    logoDraftX: state.logoDraftX,
    logoDraftY: state.logoDraftY,
    titleText: state.titleText,
    titleDraftText: state.titleDraftText,
    titleFont: state.titleFont,
    titleDraftFont: state.titleDraftFont,
    titleSize: state.titleSize,
    titleDraftSize: state.titleDraftSize,
    titleColor: state.titleColor,
    titleDraftColor: state.titleDraftColor,
    titleBgColor: state.titleBgColor,
    titleDraftBgColor: state.titleDraftBgColor,
    titleBorderColor: state.titleBorderColor,
    titleDraftBorderColor: state.titleDraftBorderColor,
    titleBorderWidth: state.titleBorderWidth,
    titleDraftBorderWidth: state.titleDraftBorderWidth,
    titleFrameColor: state.titleFrameColor,
    titleDraftFrameColor: state.titleDraftFrameColor,
    titleFrameWidth: state.titleFrameWidth,
    titleDraftFrameWidth: state.titleDraftFrameWidth,
    titlePadding: state.titlePadding,
    titleDraftPadding: state.titleDraftPadding,
    titleLineSpacing: state.titleLineSpacing,
    titleDraftLineSpacing: state.titleDraftLineSpacing,
    titleX: state.titleX,
    titleY: state.titleY,
    titleDraftX: state.titleDraftX,
    titleDraftY: state.titleDraftY,
    titleAlign: state.titleAlign,
    titleDraftAlign: state.titleDraftAlign,
    borderEnabled: state.borderEnabled,
    borderWidth: state.borderWidth,
    borderHeight: state.borderHeight,
    borderColor: state.borderColor,
    borderMode: state.borderMode,
    borderDraftEnabled: state.borderDraftEnabled,
    borderDraftWidth: state.borderDraftWidth,
    borderDraftHeight: state.borderDraftHeight,
    borderDraftColor: state.borderDraftColor,
    borderDraftMode: state.borderDraftMode,
    cropEnabled: state.cropEnabled,
    cropDraftEnabled: state.cropDraftEnabled,
    crop: state.crop,
    cropDraft: state.cropDraft,
    exportQuality: state.exportQuality,
    exportAspectRatio: state.exportAspectRatio,
    exportFilename: state.exportFilename,
    activeTab: state.activeTab,
    processedUrl: state.processedUrl,
    actionHistory: state.actionHistory,
    montageClips: state.montageClips,
    montageAudioClips: state.montageAudioClips,
    mediaAssets: state.mediaAssets,
  }),
}))
