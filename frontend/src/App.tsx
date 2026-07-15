import React, { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { Upload, Scissors, FileText, Download, Film, RotateCcw, Image as ImageIcon, Type, Square, ChevronLeft, ChevronRight, Volume2, Crop as CropIcon, CheckCircle2, X, History, ChevronDown, AlertCircle, Layers } from 'lucide-react'
import { useStore } from './store/useStore'
import ImportPanel from './components/ImportPanel/ImportPanel'
import VideoPlayer from './components/VideoPlayer/VideoPlayer'
import SubtitleEditor from './components/SubtitleEditor/SubtitleEditor'
import ExportPanel from './components/ExportPanel/ExportPanel'
import LogoEditor from './components/LogoEditor/LogoEditor'
import TitleEditor from './components/TitleEditor/TitleEditor'
import BorderEditor from './components/BorderEditor/BorderEditor'
import AudioEditor from './components/AudioEditor/AudioEditor'
import CropEditor from './components/CropEditor/CropEditor'
import MontageTimeline from './components/MontageTimeline/MontageTimeline'
import { EditSidebar } from './components/VideoTimeline/VideoTimeline'
import { getApiErrorMessage, previewVideo } from './api/client'
import { ensureTitleFontLoaded } from './hooks/useTitleFontReady'
import { getRenderedTitleFontSize, getTitleRenderLayout } from './utils/titleLayout'
import { getCroppedSourceDimensions, getRenderedVideoDimensions } from './utils/videoLayout'

type Tab = 'import' | 'montage' | 'edit' | 'crop' | 'subtitles' | 'logo' | 'title' | 'border' | 'export'

const TABS: { id: Tab; label: string; icon: React.ReactNode; requiresVideo?: boolean }[] = [
  { id: 'import', label: 'Import', icon: <Upload size={15} /> },
  { id: 'montage', label: 'Montage', icon: <Layers size={15} /> },
  { id: 'edit', label: 'Edit', icon: <Scissors size={15} />, requiresVideo: true },
  { id: 'crop', label: 'Crop', icon: <CropIcon size={15} />, requiresVideo: true },
  { id: 'subtitles', label: 'Subtitles', icon: <FileText size={15} />, requiresVideo: true },
  { id: 'logo', label: 'Logo', icon: <ImageIcon size={15} />, requiresVideo: true },
  { id: 'border', label: 'Border', icon: <Square size={15} />, requiresVideo: true },
  { id: 'title', label: 'Title', icon: <Type size={15} />, requiresVideo: true },
  { id: 'export', label: 'Export', icon: <Download size={15} />, requiresVideo: true },
]

function formatTime(s: number) {
  const totalSeconds = Math.max(0, Math.floor(s))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const sec = totalSeconds % 60

  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatActionCompletedAt(value?: string) {
  if (!value) return 'Completed recently'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Completed recently'

  return `Completed at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function isLocalAppUrl(url?: string | null) {
  if (!url || typeof window === 'undefined') return false
  if (url.startsWith('blob:') || url.startsWith('data:')) return false

  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.origin === window.location.origin
  } catch {
    return url.startsWith('/')
  }
}

async function doesLocalResourceExist(url: string) {
  try {
    const headResponse = await fetch(url, { method: 'HEAD' })
    if (headResponse.ok) return true
    if (headResponse.status !== 405) return false
  } catch {
    return false
  }

  try {
    const getResponse = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
    })
    return getResponse.ok
  } catch {
    return false
  }
}

export default function App() {
  const {
    video, activeTab, setActiveTab, reset,
    trimStart, trimEnd,
    segments, segmentHistory,
    audioTrack, audioDuration, audioApplied, appliedReplaceOriginal, appliedAudioTrimStart, appliedAudioTrimEnd, appliedAudioOffset, subtitles,
    subtitleFilename,
    appliedSubtitleStyle,
    logoImage, logoSize, logoX, logoY,
    titleText, titleFont, titleSize, titleColor, titleBgColor, titleBorderColor, titleBorderWidth, titleFrameColor, titleFrameWidth, titlePadding, titleLineSpacing, titleAlign, titleX, titleY, titleRenderLayout,
    borderEnabled, borderWidth, borderHeight, borderColor,
    cropEnabled,
    crop,
    exportQuality,
    exportAspectRatio,
    videoSourceWidth,
    videoSourceHeight,
    processedUrl, setProcessedUrl,
    previewLoading, setPreviewLoading,
    pendingPreviewAction, setPendingPreviewAction,
    actionToasts, actionHistory, pushActionToast, removeActionToast,
  } = useStore()

  const [previewError, setPreviewError] = useState<string | null>(null)
  const [actionsOpen, setActionsOpen] = useState(false)
  const debounceRef = useRef<number | null>(null)
  const lastPreviewSig = useRef<string>('')
  const pendingSig = useRef<string>('')
  const validatedProjectSig = useRef<string>('')
  const effectiveTitleSourceDimensions = getCroppedSourceDimensions({
    sourceWidth: videoSourceWidth,
    sourceHeight: videoSourceHeight,
    cropEnabled,
    crop,
  })
  const renderedTitleSize = getRenderedTitleFontSize(titleSize)
  const titleRenderedVideoDimensions = getRenderedVideoDimensions({
    sourceWidth: effectiveTitleSourceDimensions.width,
    sourceHeight: effectiveTitleSourceDimensions.height,
    quality: exportQuality,
    aspectRatio: exportAspectRatio,
    borderEnabled,
    borderWidth,
    borderHeight,
  })
  const resolvedTitleRenderLayout = titleText.trim() && titleRenderedVideoDimensions.width > 0
    ? getTitleRenderLayout({
      text: titleText,
      fontSize: renderedTitleSize,
      videoWidth: titleRenderedVideoDimensions.width,
      padding: titlePadding,
      frameWidth: titleFrameWidth,
      lineSpacing: titleLineSpacing,
      fontFamily: titleFont,
      borderWidth: titleBorderWidth,
      align: titleAlign,
    })
    : titleRenderLayout
  const resolvedTitleX = titleX ?? 0.5
  const resolvedTitleY = titleY ?? 0.2
  const resolvedTitleRenderLayoutKey = resolvedTitleRenderLayout
    ? JSON.stringify(resolvedTitleRenderLayout)
    : ''

  useEffect(() => {
    if (!video) {
      validatedProjectSig.current = ''
      return
    }

    const resources = [
      { label: 'video file', url: video.url },
      { label: 'audio file', url: audioTrack?.url },
      { label: 'logo image', url: logoImage?.url },
      { label: 'preview file', url: processedUrl },
    ].filter((resource): resource is { label: string; url: string } => !!resource.url && isLocalAppUrl(resource.url))

    if (resources.length === 0) {
      validatedProjectSig.current = ''
      return
    }

    const currentSig = resources.map(resource => `${resource.label}:${resource.url}`).join('|')
    if (validatedProjectSig.current === currentSig) return

    let cancelled = false

    void (async () => {
      const results = await Promise.all(resources.map(async resource => ({
        ...resource,
        exists: await doesLocalResourceExist(resource.url),
      })))

      if (cancelled) return

      const missingResource = results.find(resource => !resource.exists)
      if (missingResource) {
        validatedProjectSig.current = ''
        reset()
        return
      }

      validatedProjectSig.current = currentSig
    })()

    return () => {
      cancelled = true
    }
  }, [audioTrack?.url, logoImage?.url, processedUrl, reset, video, video?.url])

  const handlePreview = useCallback(async () => {
    if (!video) return
    if (titleText.trim() && !resolvedTitleRenderLayoutKey) return
    setPreviewLoading(true)
    setPreviewError(null)

    const hasTrim = trimStart > 0 || trimEnd < video.duration
    const hasCrop = cropEnabled && (crop.top > 0 || crop.bottom > 0 || crop.left > 0 || crop.right > 0)
    const hasAppliedAudio = !!audioTrack && audioApplied
    const hasAppliedAudioTrim = hasAppliedAudio && audioDuration > 0 && (appliedAudioTrimStart > 0 || appliedAudioTrimEnd < audioDuration)
    const hasAppliedSubtitles = !!subtitleFilename && !!appliedSubtitleStyle

    try {
      if (titleText.trim()) {
        await ensureTitleFontLoaded(renderedTitleSize, titleFont)
      }

      const currentTitleRenderLayout = titleText.trim() && titleRenderedVideoDimensions.width > 0
        ? getTitleRenderLayout({
          text: titleText,
          fontSize: renderedTitleSize,
          videoWidth: titleRenderedVideoDimensions.width,
          padding: titlePadding,
          frameWidth: titleFrameWidth,
          lineSpacing: titleLineSpacing,
          fontFamily: titleFont,
          borderWidth: titleBorderWidth,
          align: titleAlign,
        })
        : null

      const result = await previewVideo({
        filename: video.filename,
        quality: exportQuality,
        aspectRatio: exportAspectRatio,
        startTime: hasTrim ? trimStart : undefined,
        endTime: hasTrim ? trimEnd : undefined,
        crop: hasCrop ? crop : undefined,
        audioFilename: hasAppliedAudio ? audioTrack?.filename : undefined,
        audioStartTime: hasAppliedAudioTrim ? appliedAudioTrimStart : undefined,
        audioEndTime: hasAppliedAudioTrim ? appliedAudioTrimEnd : undefined,
        audioOffset: hasAppliedAudio ? appliedAudioOffset : undefined,
        subtitleFilename: hasAppliedSubtitles ? subtitleFilename || undefined : undefined,
        subtitleStyle: hasAppliedSubtitles ? appliedSubtitleStyle || undefined : undefined,
        titleStyle: titleText.trim() ? {
          text: titleText.trim(),
          font: titleFont,
          size: renderedTitleSize,
          color: titleColor,
          bgColor: titleBgColor,
          borderColor: titleBorderColor,
          borderWidth: titleBorderWidth,
          frameColor: titleFrameColor,
          frameWidth: titleFrameWidth,
          padding: titlePadding,
          lineSpacing: titleLineSpacing,
          align: titleAlign,
          frameMode: borderEnabled ? 'outside' : 'inside',
          x: resolvedTitleX,
          y: resolvedTitleY,
          layout: currentTitleRenderLayout || undefined,
        } : undefined,
        borderStyle: {
          enabled: borderEnabled,
          sizeX: borderWidth,
          sizeY: borderHeight,
          color: borderColor,
          mode: 'outside',
        },
        logoFilename: undefined,
      })

      setProcessedUrl(result.url)
      if (pendingPreviewAction) {
        pushActionToast(pendingPreviewAction)
        setPendingPreviewAction(null)
      }
    } catch (e: unknown) {
      const errorMessage = getApiErrorMessage(e, 'Preview failed')
      if (axios.isAxiosError(e) && e.response?.status === 404) {
        validatedProjectSig.current = ''
        reset()
      } else {
        setPreviewError(errorMessage)
      }
      if (pendingPreviewAction) setPendingPreviewAction(null)
    } finally {
      setPreviewLoading(false)
    }
  }, [
    video,
    trimStart,
    trimEnd,
    audioTrack,
    audioDuration,
    audioApplied,
    appliedAudioTrimStart,
    appliedAudioTrimEnd,
    appliedAudioOffset,
    subtitleFilename,
    appliedSubtitleStyle,
    titleText,
    titleFont,
    renderedTitleSize,
    titleColor,
    titleBgColor,
    titleBorderColor,
    titleBorderWidth,
    titleFrameColor,
    titleFrameWidth,
    titlePadding,
    titleLineSpacing,
    titleAlign,
    titleRenderedVideoDimensions.width,
    resolvedTitleX,
    resolvedTitleY,
    resolvedTitleRenderLayoutKey,
    borderEnabled,
    borderWidth,
    borderHeight,
    borderColor,
    cropEnabled,
    crop,
    exportQuality,
    exportAspectRatio,
    logoImage,
    logoSize,
    logoX,
    logoY,
    pendingPreviewAction,
    pushActionToast,
    setPreviewLoading,
    setPendingPreviewAction,
    setProcessedUrl,
  ])

  useEffect(() => {
    if (actionToasts.length === 0) return

    const timers = actionToasts.map(toast => window.setTimeout(() => {
      removeActionToast(toast.id)
    }, 9900))

    return () => {
      timers.forEach(timer => window.clearTimeout(timer))
    }
  }, [actionToasts, removeActionToast])

  useEffect(() => {
    if (!video) return
    const hasTrim = trimStart > 0 || trimEnd < video.duration
    const hasCrop = cropEnabled && (crop.top > 0 || crop.bottom > 0 || crop.left > 0 || crop.right > 0)
    const hasSubtitlesApplied = !!subtitleFilename && !!appliedSubtitleStyle
    const hasLogo = !!logoImage
    const hasTitle = titleText.trim().length > 0
    const hasBorder = borderEnabled && (borderWidth > 0 || borderHeight > 0)
    const hasOutputTransform = exportQuality !== '720p' || exportAspectRatio !== 'original'
    const hasAppliedAudio = !!audioTrack && audioApplied
    const hasAppliedAudioTrim = hasAppliedAudio && audioDuration > 0 && (appliedAudioTrimStart > 0 || appliedAudioTrimEnd < audioDuration)
    const hasChanges = hasTrim || hasCrop || hasAppliedAudio || hasAppliedAudioTrim || hasSubtitlesApplied || hasLogo || hasTitle || hasBorder || hasOutputTransform

    if (!hasChanges) {
      pendingSig.current = ''
      lastPreviewSig.current = ''
      if (processedUrl) setProcessedUrl(null)
      return
    }

    const sig = JSON.stringify({
      trimStart,
      trimEnd,
      cropEnabled,
      crop,
      audio: hasAppliedAudio
        ? {
          id: audioTrack!.id,
          duration: audioDuration,
          trimApplied: hasAppliedAudioTrim,
          replace: appliedReplaceOriginal,
          t0: appliedAudioTrimStart,
          t1: appliedAudioTrimEnd,
          offset: appliedAudioOffset,
        }
        : null,
      subtitles: hasSubtitlesApplied ? ['applied'] : [],
      subtitleFilename: hasSubtitlesApplied ? subtitleFilename : null,
      subtitleStyle: hasSubtitlesApplied ? appliedSubtitleStyle : null,
      exportQuality,
      exportAspectRatio,
      logo: logoImage ? { id: logoImage.id, size: logoSize, x: logoX, y: logoY } : null,
      title: titleText.trim() ? { text: titleText, font: titleFont, size: titleSize, color: titleColor, bg: titleBgColor, border: titleBorderColor, bw: titleBorderWidth, frame: titleFrameColor, fw: titleFrameWidth, pad: titlePadding, ls: titleLineSpacing, align: titleAlign } : null,
      titleXY: titleX !== null && titleY !== null ? { x: titleX, y: titleY } : null,
      border: borderEnabled ? { sizeX: borderWidth, sizeY: borderHeight, color: borderColor, mode: 'outside' } : null,
    })

    if (sig === lastPreviewSig.current) return
    pendingSig.current = sig

    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      if (previewLoading) return
      if (titleText.trim() && !resolvedTitleRenderLayoutKey) return
      if (pendingSig.current && pendingSig.current !== lastPreviewSig.current) {
        lastPreviewSig.current = pendingSig.current
        handlePreview()
      }
    }, 1000)

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [
    video,
    trimStart,
    trimEnd,
    cropEnabled,
    crop,
    audioTrack,
    audioDuration,
    audioApplied,
    appliedReplaceOriginal,
    appliedAudioTrimStart,
    appliedAudioTrimEnd,
    appliedAudioOffset,
    subtitleFilename,
    appliedSubtitleStyle,
    exportQuality,
    exportAspectRatio,
    logoImage,
    logoSize,
    logoX,
    logoY,
    titleText,
    titleFont,
    titleSize,
    titleColor,
    titleBgColor,
    titleBorderColor,
    titleBorderWidth,
    titleFrameColor,
    titleFrameWidth,
    titlePadding,
    titleLineSpacing,
    titleAlign,
    titleX,
    titleY,
    resolvedTitleRenderLayoutKey,
    borderEnabled,
    borderWidth,
    borderHeight,
    borderColor,
    pendingPreviewAction,
    handlePreview,
    previewLoading,
    processedUrl,
    setProcessedUrl,
  ])

  useEffect(() => {
    if (!video) return
    if (previewLoading) return
    if (titleText.trim() && !resolvedTitleRenderLayoutKey) return
    if (pendingSig.current && pendingSig.current !== lastPreviewSig.current) {
      lastPreviewSig.current = pendingSig.current
      handlePreview()
    }
  }, [handlePreview, previewLoading, resolvedTitleRenderLayoutKey, titleText, video])

  const appName = import.meta.env.VITE_APP_NAME || 'Video Editor'
  const recentActions = actionHistory.slice(-6).reverse()
  const showActionHistoryCard = recentActions.length > 0
  const hasTrim = !!video && (trimStart > 0 || trimEnd < video.duration)
  const hasCrop = cropEnabled && (crop.top > 0 || crop.bottom > 0 || crop.left > 0 || crop.right > 0)
  const hasAppliedSubtitles = !!subtitleFilename && !!appliedSubtitleStyle
  const hasLogo = !!logoImage
  const hasTitle = titleText.trim().length > 0
  const hasBorder = borderEnabled && (borderWidth > 0 || borderHeight > 0)
  const hasAppliedAudio = !!audioTrack && audioApplied
  const hasExportChanges = exportQuality !== '720p' || exportAspectRatio !== 'original'
  const completedTabs: Partial<Record<Tab, boolean>> = {
    import: !!video,
    edit: hasTrim || hasAppliedAudio || segments.length > 0 || segmentHistory.length > 0,
    crop: hasCrop,
    subtitles: hasAppliedSubtitles,
    logo: hasLogo,
    title: hasTitle,
    border: hasBorder,
    export: hasExportChanges,
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/85 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75">
        <div className="w-full px-4 sm:px-6 lg:px-8 min-h-16 py-3 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0891b2_0%,#06b6d4_55%,#67e8f9_100%)] shadow-[0_10px_24px_rgba(8,145,178,0.28)] ring-1 ring-cyan-500/20">
                <Film size={17} className="text-white" />
              </div>
              <div className="min-w-0">
                <span className="block truncate text-sm sm:text-base font-semibold tracking-tight text-zinc-900">{appName}</span>
              </div>
            </div>
            {video && (
              <>
                <div className="hidden h-8 w-px bg-zinc-200 sm:block" />
                <div className="hidden min-w-0 sm:block">
                  <div className="max-w-[14rem] lg:max-w-sm truncate text-[14px] font-medium text-zinc-600">
                    {video.title}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-2 text-xs font-semibold text-zinc-600 transition-all hover:border-zinc-300 hover:bg-white hover:text-zinc-900 hover:shadow-sm whitespace-nowrap"
                >
                  <RotateCcw size={13} /> New project
                </button>
              </>
            )}
          </div>
          <div className="ml-auto flex-shrink-0">
            {showActionHistoryCard && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActionsOpen(open => !open)}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white/90 px-3 py-2 text-xs font-semibold text-zinc-600 shadow-sm transition-all hover:border-zinc-300 hover:bg-white hover:text-zinc-900"
                  aria-label="Toggle recent actions"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                    <History size={13} />
                  </span>
                  <span className="hidden sm:inline">Recent actions</span>
                  <ChevronDown size={13} className={`transition-transform ${actionsOpen ? 'rotate-180' : ''}`} />
                </button>
                {actionsOpen && (
                  <div className="absolute right-0 top-[calc(100%+0.65rem)] z-[80] w-[min(25rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-zinc-200/90 bg-white/95 p-3 shadow-[0_24px_60px_rgba(24,24,27,0.16)] backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Activity</p>
                        <p className="mt-1 text-sm font-semibold text-zinc-900">Recent actions</p>
                      </div>
                      <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
                        {recentActions.length} items
                      </span>
                    </div>
                    <div className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1">
                      {recentActions.map(action => (
                        <div key={action.id} className="flex items-start gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/80 px-3 py-2">
                          <span className="mt-4 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-cyan-500 shadow-[0_0_0_4px_rgba(6,182,212,0.12)]" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] leading-5 text-zinc-700">{action.message}</p>
                            <p className="text-[11px] font-medium text-zinc-400">
                              {formatActionCompletedAt(action.completedAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-[1700px] mx-auto px-4 py-2">
        <div className="flex flex-col lg:flex-row gap-2 items-start">
          <div className="w-full lg:w-40 flex-shrink-0 lg:sticky lg:top-[64px]">
            <nav className="bg-white rounded-2xl p-1.5 border border-zinc-200 shadow-sm">
              {TABS.map(tab => {
                const disabled = tab.requiresVideo && !video
                const active = activeTab === tab.id
                const completed = !!completedTabs[tab.id]
                return (
                  <button
                    type="button"
                    key={tab.id}
                    onClick={() => !disabled && setActiveTab(tab.id)}
                    disabled={disabled}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active
                      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                      : disabled
                        ? 'text-zinc-300 cursor-not-allowed'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                      }`}
                  >
                    {tab.icon}
                    {tab.label}
                    {completed && (
                      <span className={`ml-auto flex h-5 w-5 items-center justify-center rounded-full ${active ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-600'
                        }`}>
                        <CheckCircle2 size={13} />
                      </span>
                    )}
                    {/* badges */}
                    {tab.id === 'subtitles' && subtitles.length > 0 && !completed && (
                      <span className="ml-auto text-xs bg-zinc-200 text-zinc-600 rounded-full px-1.5 py-0.5">
                        {subtitles.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>
          <div className="flex-1 min-w-0 w-full overflow-hidden">
            {video ? (
              <div className='space-y-1'>
                <div className="justify-between bg-white rounded-2xl border border-zinc-200 px-4 py-2 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {video.thumbnail && (
                      <img
                        src={video.thumbnail}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        onError={event => {
                          event.currentTarget.style.display = 'none'
                        }}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">{video.title}</p>
                      <p className="text-xs text-zinc-500">
                        {formatTime(video.duration)} &nbsp;·&nbsp; Trim: {formatTime(trimStart)}–{formatTime(trimEnd)}
                        {cropEnabled && (crop.top > 0 || crop.bottom > 0 || crop.left > 0 || crop.right > 0) && <>&nbsp;·&nbsp; <span className="text-emerald-600">Crop</span></>}
                        {segments.length > 0 && <>&nbsp;·&nbsp; <span className="text-yellow-600">{segments.length} segments</span></>}
                        {audioTrack && <>&nbsp;·&nbsp; <span className="text-yellow-600">Audio ♪</span></>}
                        {subtitles.length > 0 && <>&nbsp;·&nbsp; <span className="text-yellow-600">{subtitles.length} subs</span></>}
                        {titleText.trim() && <>&nbsp;·&nbsp; <span className="text-yellow-600">Title</span></>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingPreviewAction('Preview updated successfully.')
                        void handlePreview()
                      }}
                      disabled={previewLoading}
                      className="px-2 py-2 rounded-lg text-[11px] font-medium bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-200 disabled:text-zinc-400 text-white transition-colors"
                    >
                      {previewLoading ? 'Generating preview...' : 'Preview changes'}
                    </button>
                    {processedUrl && (
                      <button
                        onClick={() => setProcessedUrl(null)}
                        className="px-2 py-2 rounded-lg text-[11px] font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors"
                      >
                        Show original
                      </button>
                    )}
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-zinc-200 p-2">
                  <VideoPlayer />
                </div>
                {actionToasts.length > 0 && (
                  <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
                    {actionToasts.map(toast => (
                      <div
                        key={toast.id}
                        className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-emerald-200 bg-white/95 px-4 py-3 shadow-[0_16px_40px_rgba(5,150,105,0.16)] backdrop-blur-sm"
                      >
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                          <CheckCircle2 size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Preview</p>
                          <p className="mt-1 text-sm text-zinc-700">{toast.message}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeActionToast(toast.id)}
                          className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                          aria-label="Close notification"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {previewError && (
                  <div className="pointer-events-none fixed bottom-4 left-4 z-[70] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
                    <div className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-red-200 bg-white/95 px-4 py-3 shadow-[0_16px_40px_rgba(220,38,38,0.14)] backdrop-blur-sm">
                      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600">
                        <AlertCircle size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">Preview error</p>
                        <p className="mt-1 text-sm text-zinc-700">{previewError}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewError(null)}
                        className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                        aria-label="Close preview error"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}
                {activeTab === 'subtitles' && subtitles.length > 0 && (
                  <div className="overflow-hidden rounded-3xl border border-zinc-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(244,244,245,0.96)_100%)] shadow-[0_18px_45px_rgba(24,24,27,0.08)] backdrop-blur-sm">
                    <div className="flex items-center justify-between gap-3 border-b border-zinc-200/80 px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 ring-1 ring-cyan-100">
                            <FileText size={16} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-zinc-900">Subtitle preview</h3>
                            <p className="text-[11px] text-zinc-500">Quick look at the first subtitle lines</p>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
                        {subtitles.length} lines
                      </div>
                    </div>
                    <div className="max-h-48 space-y-2 overflow-y-auto px-3 py-3">
                      {subtitles.slice(0, 10).map((s, i) => (
                        <div
                          key={i}
                          className="rounded-2xl border border-white/80 bg-white/90 px-3 py-2.5 shadow-[0_10px_24px_rgba(24,24,27,0.04)]"
                        >
                          <div className="flex items-start gap-3">
                            <div className="min-w-[88px] shrink-0 rounded-xl bg-zinc-100 px-2 py-1 text-center font-mono text-[10px] font-medium tracking-wide text-zinc-500">
                              <div>{s.startTime.slice(0, 8)}</div>
                              <div className="text-zinc-400">{s.endTime.slice(0, 8)}</div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Line {i + 1}</p>
                              <p className="mt-1 text-sm leading-5 text-zinc-700">{s.text}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {subtitles.length > 10 && (
                        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/70 px-3 py-2 text-center text-xs font-medium text-zinc-500">
                          +{subtitles.length - 10} more subtitle lines
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-zinc-200 border-dashed h-full min-h-[360px] sm:min-h-[500px] flex flex-col items-center justify-center p-8 sm:p-10 text-center">
                <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mb-4">
                  <Film size={28} className="text-zinc-500" />
                </div>
                <h2 className="text-lg font-semibold text-zinc-700 mb-2">No video loaded</h2>
                <p className="text-sm text-zinc-500 max-w-xs">
                  Use the Import tab on the right to load a video from YouTube, Instagram, Facebook, or a local file.
                </p>
              </div>
            )}
          </div>
          <div className="w-full lg:w-80 xl:w-[28rem] flex-shrink-0 lg:sticky lg:top-[64px]">
            <div className="bg-white rounded-2xl px-4 py-2 border border-zinc-200 min-h-[300px] shadow-sm">
              {activeTab === 'import' && <ImportPanel />}
              {activeTab === 'montage' && <MontageTimeline />}
              {activeTab === 'edit' && <EditPanel />}
              {activeTab === 'crop' && <CropEditor />}
              {activeTab === 'subtitles' && <SubtitleEditor />}
              {activeTab === 'logo' && <LogoEditor />}
              {activeTab === 'title' && <TitleEditor />}
              {activeTab === 'border' && <BorderEditor />}
              {activeTab === 'export' && <ExportPanel />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditPanel() {
  const {
    video,
    trimStart,
    trimEnd,
    setTrimStart,
    setTrimEnd,
  } = useStore()
  const [editTab, setEditTab] = useState<'video' | 'audio'>('video')

  if (!video) return null

  const minGap = 0.1
  const duration = video.duration || 0

  const nudgeStart = (delta: number) => {
    const nextStart = Math.max(0, Math.min(trimStart + delta, trimEnd - minGap))
    setTrimStart(nextStart)
  }

  const nudgeEnd = (delta: number) => {
    const nextEnd = Math.min(duration, Math.max(trimEnd + delta, trimStart + minGap))
    setTrimEnd(nextEnd)
  }

  return (
    <div className="space-y-2">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 mb-1">Edit</h2>
        <p className="text-xs text-zinc-500">
          Choose video or audio editing options below
        </p>
      </div>

      {/* Edit Tabs */}
      <div className="flex gap-2 border-b border-zinc-200">
        <button
          type="button"
          onClick={() => setEditTab('video')}
          className={`py-2 px-1 text-xs font-medium transition-all flex items-center justify-center gap-1.5 border-b-2 ${editTab === 'video' ? 'border-cyan-600 text-cyan-600' : 'border-transparent text-zinc-500 hover:text-zinc-600'
            }`}
        >
          <Film size={13} /> Video
        </button>
        <button
          type="button"
          onClick={() => setEditTab('audio')}
          className={`py-2 px-1 text-xs font-medium transition-all flex items-center justify-center gap-1.5 border-b-2 ${editTab === 'audio' ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-600'
            }`}
        >
          <Volume2 size={13} /> Audio
        </button>
      </div>

      {/* Video Edit Tab */}
      {editTab === 'video' && (
        <>
          <div className="rounded-xl border border-cyan-100 bg-[linear-gradient(180deg,#f2fcff_0%,#f8fdff_100%)] px-3 py-3 space-y-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
            <div>
              <p className="text-xs text-cyan-700/60">Timeline — Current Selection</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-cyan-200 bg-white/80 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-700/60">Start</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-900">{formatTime2(trimStart)}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => nudgeStart(-1)}
                      className="rounded-md border border-cyan-200 bg-cyan-50 p-1 text-cyan-700 hover:bg-cyan-100"
                      aria-label="Move start earlier by one second"
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => nudgeStart(1)}
                      className="rounded-md border border-cyan-200 bg-cyan-50 p-1 text-cyan-700 hover:bg-cyan-100"
                      aria-label="Move start later by one second"
                    >
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-cyan-200 bg-white/80 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-700/60">End</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-900">{formatTime2(trimEnd)}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => nudgeEnd(-1)}
                      className="rounded-md border border-cyan-200 bg-cyan-50 p-1 text-cyan-700 hover:bg-cyan-100"
                      aria-label="Move end earlier by one second"
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => nudgeEnd(1)}
                      className="rounded-md border border-cyan-200 bg-cyan-50 p-1 text-cyan-700 hover:bg-cyan-100"
                      aria-label="Move end later by one second"
                    >
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <EditSidebar />
        </>
      )}

      {/* Audio Edit Tab */}
      {editTab === 'audio' && (
        <AudioEditor />
      )}
    </div>
  )
}

function formatTime2(s: number) {
  const totalSeconds = Math.max(0, Math.floor(s))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const sec = totalSeconds % 60

  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  return `${m}:${sec.toString().padStart(2, '0')}`
}
