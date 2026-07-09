import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Play, Pause } from 'lucide-react'
import { useTitleFontReady } from '../../hooks/useTitleFontReady'
import { useStore } from '../../store/useStore'
import { withMediaBase } from '../../utils/media'
import { applyTitleCanvasTextStyle, clampNormalizedCenter, getRenderedTitleFontSize, getTitleRenderLayout } from '../../utils/titleLayout'
import { getContainRect, getCroppedSourceDimensions, getRenderedVideoDimensions } from '../../utils/videoLayout'
import VideoTimeline from '../VideoTimeline/VideoTimeline'

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

export default function VideoPlayer() {
  const {
    video, trimStart, trimEnd, setTrimEnd, processedUrl, audioTrack, audioDuration, audioApplied, appliedReplaceOriginal,
    appliedAudioTrimStart, appliedAudioTrimEnd, appliedAudioOffset, activeTab, titleText, titleFont, titleDraftFont, titleSize, titleDraftSize, titleColor, titleDraftColor, titleBgColor, titleDraftBgColor,
    titleBorderColor, titleDraftBorderColor, titleBorderWidth, titleDraftBorderWidth, titleFrameColor, titleDraftFrameColor, titleFrameWidth, titleDraftFrameWidth, titlePadding, titleDraftPadding, titleLineSpacing, titleDraftLineSpacing, titleX, titleY, titleDraftX,
    titleDraftY, setTitleDraftXY, titleDraftText, titleAlign, titleDraftAlign, isApplyingTitle, previewLoading, logoImage, logoSize,
    logoDraftImage, logoDraftSize, logoDraftX, logoDraftY, logoX, logoY, setLogoDraftXY, borderEnabled, borderWidth,
    borderHeight, borderMode, cropEnabled, cropDraftEnabled, crop, cropDraft, exportQuality, exportAspectRatio, seekTo,
    setSeekTo, setTitleRenderLayout, videoSourceWidth, videoSourceHeight, setVideoSourceDimensions } = useStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const titleCanvasRef = useRef<HTMLCanvasElement>(null)
  const draggingRef = useRef(false)
  const logoDraggingRef = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [mediaDuration, setMediaDuration] = useState(0)
  const [videoDisplayRect, setVideoDisplayRect] = useState({ left: 0, top: 0, width: 0, height: 0 })
  const hasPendingCropChanges =
    activeTab === 'crop' && (
      cropDraftEnabled !== cropEnabled ||
      cropDraft.top !== crop.top ||
      cropDraft.bottom !== crop.bottom ||
      cropDraft.left !== crop.left ||
      cropDraft.right !== crop.right
    )
  const fullDuration = mediaDuration || video?.duration || 0
  const effectiveStart = trimStart
  const effectiveEnd = trimEnd || fullDuration
  const effectiveDuration = Math.max(0, effectiveEnd - effectiveStart)

  const src = withMediaBase((hasPendingCropChanges ? video?.url : (processedUrl || video?.url)) || '')
  const originalVideoSrc = withMediaBase(video?.url || '')
  const isMuted = audioApplied && appliedReplaceOriginal && !!audioTrack
  const audioSegStart = audioApplied ? appliedAudioTrimStart : 0
  const audioSegEnd = audioApplied ? (appliedAudioTrimEnd || audioDuration) : audioDuration
  const syncAudioToVideo = useCallback((videoTime: number, shouldPlay: boolean) => {
    const audioEl = audioRef.current
    if (!audioEl || !audioApplied) return

    const audioLead = videoTime - appliedAudioOffset
    if (audioLead < 0) {
      audioEl.pause()
      audioEl.currentTime = audioSegStart
      return
    }

    const nextAudioTime = audioSegStart + audioLead
    if (nextAudioTime >= audioSegEnd) {
      audioEl.pause()
      if (audioSegEnd > audioSegStart) {
        audioEl.currentTime = audioSegEnd
      }
      return
    }

    if (Math.abs(audioEl.currentTime - nextAudioTime) > 0.3) {
      audioEl.currentTime = nextAudioTime
    }

    if (shouldPlay) {
      void audioEl.play().catch(() => { })
    } else {
      audioEl.pause()
    }
  }, [appliedAudioOffset, audioApplied, audioSegEnd, audioSegStart])

  useEffect(() => {
    if (video) setTrimEnd(video.duration)
  }, [setTrimEnd, video])

  useEffect(() => {
    if (seekTo !== null && videoRef.current) {
      const next = Math.min(Math.max(seekTo, 0), fullDuration)
      videoRef.current.currentTime = next
      syncAudioToVideo(next, true)
      setCurrentTime(next)
      setSeekTo(null)
      videoRef.current.play()
      setPlaying(true)
    }
  }, [seekTo, fullDuration, setSeekTo, syncAudioToVideo])

  useEffect(() => {
    setMediaDuration(0)
    setCurrentTime(0)
    setPlaying(false)
  }, [src])


  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (v.currentTime < effectiveStart || v.currentTime > effectiveEnd) {
      v.currentTime = effectiveStart
      syncAudioToVideo(effectiveStart, false)
      setCurrentTime(effectiveStart)
    }
  }, [effectiveStart, effectiveEnd, syncAudioToVideo])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = effectiveStart
    syncAudioToVideo(effectiveStart, false)
    setCurrentTime(effectiveStart)
    setPlaying(false)
    v.pause()
    audioRef.current?.pause()
  }, [effectiveStart, effectiveEnd, syncAudioToVideo])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (playing) {
      v.pause()
      audioRef.current?.pause()
      setPlaying(false)
    } else {
      v.play()
      syncAudioToVideo(v.currentTime, true)
      setPlaying(true)
    }
  }

  const handleTimeUpdate = () => {
    const v = videoRef.current
    if (!v) return
    setCurrentTime(v.currentTime)
    if (v.currentTime >= effectiveEnd) {
      v.pause()
      audioRef.current?.pause()
      setPlaying(false)
    }
    syncAudioToVideo(v.currentTime, !v.paused && v.currentTime < effectiveEnd)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value)
    const next = effectiveStart + t
    if (videoRef.current) videoRef.current.currentTime = next
    syncAudioToVideo(next, playing)
    setCurrentTime(next)
  }

  const handleTimelineSeek = (t: number) => {
    const next = Math.min(Math.max(t, 0), fullDuration)
    if (videoRef.current) videoRef.current.currentTime = next
    syncAudioToVideo(next, playing)
    setCurrentTime(next)
  }
  const updateVideoDisplayRect = useCallback(() => {
    const container = overlayRef.current
    const videoEl = videoRef.current
    if (!container || !videoEl) return

    const containerRect = container.getBoundingClientRect()
    const intrinsicWidth = videoEl.videoWidth || 0
    const intrinsicHeight = videoEl.videoHeight || 0
    if (!intrinsicWidth || !intrinsicHeight || !containerRect.width || !containerRect.height) {
      setVideoDisplayRect({ left: 0, top: 0, width: containerRect.width, height: containerRect.height })
      return
    }

    const videoRatio = intrinsicWidth / intrinsicHeight
    const containerRatio = containerRect.width / containerRect.height

    let width = containerRect.width
    let height = containerRect.height

    if (videoRatio > containerRatio) {
      height = width / videoRatio
    } else {
      width = height * videoRatio
    }

    setVideoDisplayRect({
      left: (containerRect.width - width) / 2,
      top: (containerRect.height - height) / 2,
      width,
      height,
    })
  }, [])

  const getRelativePointInRect = useCallback((
    clientX: number,
    clientY: number,
    targetRect: { left: number; top: number; width: number; height: number },
  ) => {
    const rect = overlayRef.current?.getBoundingClientRect()
    if (!rect || !targetRect.width || !targetRect.height) return null

    const localX = clientX - rect.left - targetRect.left
    const localY = clientY - rect.top - targetRect.top

    return {
      x: Math.min(1, Math.max(0, localX / targetRect.width)),
      y: Math.min(1, Math.max(0, localY / targetRect.height)),
    }
  }, [])

  useEffect(() => {
    updateVideoDisplayRect()
    window.addEventListener('resize', updateVideoDisplayRect)
    return () => window.removeEventListener('resize', updateVideoDisplayRect)
  }, [src, updateVideoDisplayRect])

  const draftLogoX = logoDraftX ?? logoX ?? 0.9
  const draftLogoY = logoDraftY ?? logoY ?? 0.1
  const previewCrop = activeTab === 'crop' && cropDraftEnabled ? cropDraft : crop
  const hasPreviewCrop = (activeTab === 'crop' ? cropDraftEnabled : cropEnabled)
    && (previewCrop.top > 0 || previewCrop.bottom > 0 || previewCrop.left > 0 || previewCrop.right > 0)
  const videoIntrinsicWidth = videoRef.current?.videoWidth || 0
  const videoIntrinsicHeight = videoRef.current?.videoHeight || 0
  const baseSourceWidth = videoSourceWidth || videoIntrinsicWidth
  const baseSourceHeight = videoSourceHeight || videoIntrinsicHeight
  const previewTitleText = activeTab === 'title' ? titleDraftText || titleText : titleText
  const previewTitleX = activeTab === 'title' ? titleDraftX ?? titleX ?? 0.5 : titleX ?? 0.5
  const previewTitleY = activeTab === 'title' ? titleDraftY ?? titleY ?? 0.2 : titleY ?? 0.2
  const previewTitleFont = activeTab === 'title' ? titleDraftFont || titleFont : titleFont
  const previewTitleSize = activeTab === 'title' ? titleDraftSize || titleSize : titleSize
  const previewTitleColor = activeTab === 'title' ? titleDraftColor || titleColor : titleColor
  const previewTitleBgColor = activeTab === 'title' ? titleDraftBgColor || titleBgColor : titleBgColor
  const previewTitleBorderColor = activeTab === 'title' ? titleDraftBorderColor || titleBorderColor : titleBorderColor
  const previewTitleBorderWidth = activeTab === 'title' ? titleDraftBorderWidth : titleBorderWidth
  const previewTitleFrameColor = activeTab === 'title' ? titleDraftFrameColor || titleFrameColor : titleFrameColor
  const previewTitleFrameWidth = activeTab === 'title' ? titleDraftFrameWidth : titleFrameWidth
  const previewTitlePadding = activeTab === 'title' ? titleDraftPadding : titlePadding
  const previewTitleLineSpacing = activeTab === 'title' ? titleDraftLineSpacing : titleLineSpacing
  const previewTitleAlign = activeTab === 'title' ? titleDraftAlign || titleAlign : titleAlign
  const renderedAppliedTitleSize = getRenderedTitleFontSize(titleSize)
  const previewTitleFontReady = useTitleFontReady(previewTitleSize, previewTitleFont)
  const appliedTitleFontReady = useTitleFontReady(renderedAppliedTitleSize, titleFont)
  const effectiveSourceDimensions = getCroppedSourceDimensions({
    sourceWidth: baseSourceWidth,
    sourceHeight: baseSourceHeight,
    cropEnabled,
    crop,
  })
  const renderedVideoDimensions = getRenderedVideoDimensions({
    sourceWidth: effectiveSourceDimensions.width,
    sourceHeight: effectiveSourceDimensions.height,
    quality: exportQuality,
    aspectRatio: exportAspectRatio,
    borderEnabled,
    borderWidth,
    borderHeight,
    borderMode,
  })
  const titleOuterRect = getContainRect({
    containerWidth: overlayRef.current?.clientWidth || 0,
    containerHeight: overlayRef.current?.clientHeight || 0,
    contentWidth: renderedVideoDimensions.width || videoIntrinsicWidth || videoDisplayRect.width,
    contentHeight: renderedVideoDimensions.height || videoIntrinsicHeight || videoDisplayRect.height,
  })
  const titleDraftRect = titleOuterRect
  const logoDraftRect = getContainRect({
    containerWidth: overlayRef.current?.clientWidth || 0,
    containerHeight: overlayRef.current?.clientHeight || 0,
    contentWidth: renderedVideoDimensions.width || videoIntrinsicWidth || videoDisplayRect.width,
    contentHeight: renderedVideoDimensions.height || videoIntrinsicHeight || videoDisplayRect.height,
  })
  const fullPreviewWidth = renderedVideoDimensions.width || videoIntrinsicWidth || 0
  const previewTitleLayoutWidth = Math.max(0, fullPreviewWidth)
  const titlePreviewScale = previewTitleLayoutWidth > 0 && titleDraftRect.width > 0
    ? titleDraftRect.width / previewTitleLayoutWidth
    : 1
  const previewTitleLayout = getTitleRenderLayout({
    text: previewTitleText,
    fontSize: previewTitleSize,
    videoWidth: previewTitleLayoutWidth,
    padding: previewTitlePadding,
    frameWidth: previewTitleFrameWidth,
    lineSpacing: previewTitleLineSpacing,
    fontFamily: previewTitleFont,
    borderWidth: previewTitleBorderWidth,
    align: previewTitleAlign,
  })
  const appliedTitleLayoutWidth = previewTitleLayoutWidth
  const previewTitleBoxWidth = (previewTitleLayout?.blockWidth || 0) * titlePreviewScale
  const previewTitleBoxHeight = (previewTitleLayout?.blockHeight || 0) * titlePreviewScale
  const constrainedPreviewTitleX = clampNormalizedCenter(previewTitleX, titleDraftRect.width, previewTitleBoxWidth)
  const constrainedPreviewTitleY = clampNormalizedCenter(previewTitleY, titleDraftRect.height, previewTitleBoxHeight)

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      const point = getRelativePointInRect(e.clientX, e.clientY, titleDraftRect)
      if (!point) return
      const nextX = clampNormalizedCenter(point.x, titleDraftRect.width, previewTitleBoxWidth)
      const nextY = clampNormalizedCenter(point.y, titleDraftRect.height, previewTitleBoxHeight)
      setTitleDraftXY(nextX, nextY)
    }
    const handleLogoMove = (e: MouseEvent) => {
      if (!logoDraggingRef.current) return
      const point = getRelativePointInRect(e.clientX, e.clientY, logoDraftRect)
      if (!point) return
      setLogoDraftXY(point.x, point.y)
    }
    const handleUp = () => {
      draggingRef.current = false
      logoDraggingRef.current = false
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mousemove', handleLogoMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mousemove', handleLogoMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [getRelativePointInRect, logoDraftRect, previewTitleBoxHeight, previewTitleBoxWidth, setLogoDraftXY, setTitleDraftXY, titleDraftRect])

  useEffect(() => {
    const canvas = titleCanvasRef.current
    if (!canvas) return

    const layout = previewTitleLayout
    const cssWidth = Math.max(1, previewTitleBoxWidth || 1)
    const cssHeight = Math.max(1, previewTitleBoxHeight || 1)
    const dpr = window.devicePixelRatio || 1

    canvas.width = Math.max(1, Math.round(cssWidth * dpr))
    canvas.height = Math.max(1, Math.round(cssHeight * dpr))
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${cssHeight}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!layout || !previewTitleText.trim()) return

    ctx.setTransform(dpr * titlePreviewScale, 0, 0, dpr * titlePreviewScale, 0, 0)

    if (previewTitleFrameWidth > 0) {
      ctx.fillStyle = previewTitleFrameColor
      ctx.fillRect(
        layout.frameBounds.x,
        layout.frameBounds.y,
        layout.frameBounds.width,
        layout.frameBounds.height,
      )
    }

    ctx.fillStyle = previewTitleBgColor
    ctx.fillRect(
      layout.backgroundBounds.x,
      layout.backgroundBounds.y,
      layout.backgroundBounds.width,
      layout.backgroundBounds.height,
    )

    applyTitleCanvasTextStyle(ctx, previewTitleSize, previewTitleFont)
    ctx.lineJoin = 'round'
    ctx.miterLimit = 2
    ctx.fillStyle = previewTitleColor
    ctx.strokeStyle = previewTitleBorderColor
    ctx.lineWidth = previewTitleBorderWidth * 2
    layout.lines.forEach((line) => {
      if (!line.text.trim()) return
      if (previewTitleBorderWidth > 0) {
        ctx.strokeText(line.text, line.drawX, line.baselineY)
      }
      ctx.fillText(line.text, line.drawX, line.baselineY)
    })
  }, [
    previewTitleLayout,
    previewTitleText,
    previewTitleSize,
    previewTitleFont,
    previewTitleColor,
    previewTitleBgColor,
    previewTitleBorderColor,
    previewTitleBorderWidth,
    previewTitleFrameColor,
    previewTitleFrameWidth,
    previewTitleBoxWidth,
    previewTitleBoxHeight,
    previewTitleFontReady,
    titlePreviewScale,
  ])

  useEffect(() => {
    setTitleRenderLayout(getTitleRenderLayout({
      text: titleText,
      fontSize: renderedAppliedTitleSize,
      videoWidth: appliedTitleLayoutWidth,
      padding: titlePadding,
      frameWidth: titleFrameWidth,
      lineSpacing: titleLineSpacing,
      fontFamily: titleFont,
      borderWidth: titleBorderWidth,
      align: titleAlign,
    }))
  }, [
    titleText,
    titleFont,
    renderedAppliedTitleSize,
    titlePadding,
    titleFrameWidth,
    titleLineSpacing,
    titleAlign,
    titleBorderWidth,
    appliedTitleLayoutWidth,
    appliedTitleFontReady,
    setTitleRenderLayout,
  ])

  if (!video) return null

  return (
    <div className="space-y-2">
      <div ref={overlayRef} className="relative bg-zinc-950 rounded-xl overflow-hidden w-full flex items-center justify-center h-[40vh] min-h-[372px]">
        <video ref={videoRef} src={src} muted={isMuted} className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setPlaying(false)}
          onLoadedMetadata={() => {
            let nextStart = trimStart
            if (videoRef.current) {
              const actualDuration = Number.isFinite(videoRef.current.duration) ? videoRef.current.duration : 0
              setMediaDuration(actualDuration)
              if (src === originalVideoSrc || !videoSourceWidth || !videoSourceHeight) {
                setVideoSourceDimensions(videoRef.current.videoWidth || 0, videoRef.current.videoHeight || 0)
              }
              nextStart = Math.min(trimStart, actualDuration || trimStart)
              videoRef.current.currentTime = nextStart
              setCurrentTime(nextStart)
            }
            updateVideoDisplayRect()
            syncAudioToVideo(nextStart, false)
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center cursor-pointer" onClick={togglePlay}>
          {!playing && (
            <div className="w-14 h-14 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Play size={24} className="text-white ml-1" />
            </div>
          )}
        </div>

        {activeTab === 'crop' && cropDraftEnabled && hasPreviewCrop && hasPendingCropChanges && videoDisplayRect.width > 0 && videoDisplayRect.height > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {previewCrop.top > 0 && (
              <div
                className="absolute bg-black/55 backdrop-blur-[1px]"
                style={{
                  left: `${videoDisplayRect.left}px`,
                  top: `${videoDisplayRect.top}px`,
                  width: `${videoDisplayRect.width}px`,
                  height: `${videoDisplayRect.height * previewCrop.top}px`,
                }}
              />
            )}
            {previewCrop.bottom > 0 && (
              <div
                className="absolute bg-black/55 backdrop-blur-[1px]"
                style={{
                  left: `${videoDisplayRect.left}px`,
                  top: `${videoDisplayRect.top + videoDisplayRect.height * (1 - previewCrop.bottom)}px`,
                  width: `${videoDisplayRect.width}px`,
                  height: `${videoDisplayRect.height * previewCrop.bottom}px`,
                }}
              />
            )}
            {previewCrop.left > 0 && (
              <div
                className="absolute bg-black/55 backdrop-blur-[1px]"
                style={{
                  left: `${videoDisplayRect.left}px`,
                  top: `${videoDisplayRect.top + videoDisplayRect.height * previewCrop.top}px`,
                  width: `${videoDisplayRect.width * previewCrop.left}px`,
                  height: `${videoDisplayRect.height * (1 - previewCrop.top - previewCrop.bottom)}px`,
                }}
              />
            )}
            {previewCrop.right > 0 && (
              <div
                className="absolute bg-black/55 backdrop-blur-[1px]"
                style={{
                  left: `${videoDisplayRect.left + videoDisplayRect.width * (1 - previewCrop.right)}px`,
                  top: `${videoDisplayRect.top + videoDisplayRect.height * previewCrop.top}px`,
                  width: `${videoDisplayRect.width * previewCrop.right}px`,
                  height: `${videoDisplayRect.height * (1 - previewCrop.top - previewCrop.bottom)}px`,
                }}
              />
            )}
            {hasPendingCropChanges && (
              <div
                className="absolute rounded-xl border border-emerald-400/80 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]"
                style={{
                  left: `${videoDisplayRect.left + videoDisplayRect.width * previewCrop.left}px`,
                  top: `${videoDisplayRect.top + videoDisplayRect.height * previewCrop.top}px`,
                  width: `${videoDisplayRect.width * (1 - previewCrop.left - previewCrop.right)}px`,
                  height: `${videoDisplayRect.height * (1 - previewCrop.top - previewCrop.bottom)}px`,
                }}
              >
                <div className="absolute left-2 top-2 rounded-full bg-emerald-500/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                  Visible frame
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'title' && (
          <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
            <div
              onMouseDown={() => {
                if (previewLoading || isApplyingTitle || activeTab !== 'title') return
                draggingRef.current = true
              }}
              className={`absolute rounded-md select-none ${activeTab === 'title' ? (previewLoading || isApplyingTitle ? 'cursor-not-allowed' : 'cursor-move') : ''
                } ${(previewTitleText.trim() ? '' : 'opacity-60 italic')}`}
              style={{
                left: `${titleDraftRect.left + (constrainedPreviewTitleX * titleDraftRect.width)}px`,
                top: `${titleDraftRect.top + (constrainedPreviewTitleY * titleDraftRect.height)}px`,
                transform: 'translate(-50%, -50%)',
                pointerEvents: activeTab === 'title' ? 'auto' : 'none',
                width: `${previewTitleBoxWidth}px`,
                height: `${previewTitleBoxHeight}px`,
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  overflow: 'hidden',
                }}
              >
                <canvas
                  ref={titleCanvasRef}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'block',
                  }}
                />
              </div>
            </div>
          </div>
        )}
        {(activeTab === 'logo' ? logoDraftImage : logoImage) && (
          <div
            className="absolute inset-0"
            style={{ pointerEvents: 'none' }}
          >
            <img
              src={(activeTab === 'logo' ? logoDraftImage : logoImage)!.url}
              alt="Logo overlay"
              onMouseDown={() => { if (activeTab === 'logo') logoDraggingRef.current = true }}
              className={`absolute select-none ${activeTab === 'logo' ? 'cursor-move' : ''}`}
              style={{
                left: `${logoDraftRect.left + ((activeTab === 'logo' ? draftLogoX : logoX ?? 0.9) * logoDraftRect.width)}px`,
                top: `${logoDraftRect.top + ((activeTab === 'logo' ? draftLogoY : logoY ?? 0.1) * logoDraftRect.height)}px`,
                transform: 'translate(-50%, -50%)',
                width: `${((activeTab === 'logo' ? logoDraftSize : logoSize) / 100) * logoDraftRect.width}px`,
                height: 'auto',
                pointerEvents: activeTab === 'logo' ? 'auto' : 'none',
              }}
            />
          </div>
        )}
      </div>
      <div className="bg-zinc-50 rounded-xl px-3 py-2 space-y-2 border border-zinc-200">
        <div className="flex items-center gap-3">
          <button type="button" onClick={togglePlay} className="text-zinc-900 hover:text-cyan-600 transition-colors flex-shrink-0">
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <input
            type="range"
            min={0}
            max={effectiveDuration || 0}
            step={0.1}
            value={Math.max(0, currentTime - effectiveStart)}
            onChange={handleSeek}
            aria-label="Seek video"
            className="flex-1 accent-cyan-600 h-1"
          />
          <span className="text-xs text-zinc-500 font-mono w-20 text-right">
            {formatTime(Math.max(0, currentTime - effectiveStart))} / {formatTime(effectiveDuration)}
          </span>
        </div>
      </div>

      {activeTab === 'edit' && (
        <VideoTimeline currentTime={currentTime} onSeek={handleTimelineSeek} />
      )}

      {audioTrack && audioApplied && (
        <audio
          ref={audioRef}
          src={withMediaBase(audioTrack.url)}
          onTimeUpdate={() => {
            const a = audioRef.current
            if (!a || !audioApplied) return
            if (audioSegEnd > 0 && a.currentTime >= audioSegEnd) {
              a.pause()
              return
            }
          }}
          className="hidden"
          preload="auto"
        />
      )}
    </div >
  )
}
