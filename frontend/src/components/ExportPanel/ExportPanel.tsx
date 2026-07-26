import { useState, useRef } from 'react'
import {
  Download, Loader2, CheckCircle2, Scissors, Crop as CropIcon, Music, FileText,
  Image as ImageIcon, Type, Square, Youtube, Instagram, Facebook, Linkedin, Twitter, Music2, ArrowRight, Monitor, FileVideo, X
} from 'lucide-react'
import { exportVideo } from '../../api/client'
import { ensureTitleFontLoaded } from '../../hooks/useTitleFontReady'
import { useStore } from '../../store/useStore'
import { getRenderedTitleFontSize, getTitleRenderLayout } from '../../utils/titleLayout'
import { getCroppedSourceDimensions, getRenderedVideoDimensions } from '../../utils/videoLayout'

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function ExportPanel() {
  const {
    video, trimStart, trimEnd, audioTrack, audioDuration, audioApplied, appliedReplaceOriginal,
    appliedAudioTrimStart, appliedAudioTrimEnd, subtitles, subtitleFilename, appliedSubtitleStyle,
    logoImage, logoSize, logoX, logoY, titleText, titleFont, titleSize, titleColor, titleBgColor,
    titleBorderColor, titleBorderWidth, titleFrameColor, titleFrameWidth, titlePadding, titleLineSpacing, titleAlign, titleX,
    titleY, borderEnabled, borderWidth, borderHeight, borderColor, appliedAudioOffset,
    cropEnabled, crop, exportAspectRatio, setExportAspectRatio, exportFilename,
    setExportFilename, setProcessedUrl, videoSourceWidth, videoSourceHeight,
  } = useStore()

  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('')
  const [exportProgress, setExportProgress] = useState(0)
  const [done, setDone] = useState<{ url: string; downloadUrl: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exportTab, setExportTab] = useState<'name' | 'summary'>('name')
  const abortControllerRef = useRef<AbortController | null>(null)

  const hasTrim = video && (trimStart > 0 || trimEnd < video.duration)
  const hasCrop = cropEnabled && (crop.top > 0 || crop.bottom > 0 || crop.left > 0 || crop.right > 0)
  const hasAudio = !!audioTrack
  const hasSubtitles = !!subtitleFilename && !!appliedSubtitleStyle
  const hasLogo = !!logoImage
  const hasAppliedAudio = !!audioTrack && audioApplied
  const hasAppliedAudioTrim = hasAppliedAudio && audioDuration > 0 && (appliedAudioTrimStart > 0 || appliedAudioTrimEnd < audioDuration)
  const renderedTitleSize = getRenderedTitleFontSize(titleSize)
  const effectiveTitleSourceDimensions = getCroppedSourceDimensions({
    sourceWidth: videoSourceWidth,
    sourceHeight: videoSourceHeight,
    cropEnabled,
    crop,
  })
  const renderedVideoDimensions = getRenderedVideoDimensions({
    sourceWidth: effectiveTitleSourceDimensions.width,
    sourceHeight: effectiveTitleSourceDimensions.height,
    aspectRatio: exportAspectRatio,
    borderEnabled,
    borderWidth,
    borderHeight,
  })
  const resolvedTitleX = titleX ?? 0.5
  const resolvedTitleY = titleY ?? 0.2

  const handleExport = async () => {
    if (!video) return
    setLoading(true)
    setError(null)
    setDone(null)
    setExportProgress(0)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      if (titleText.trim()) {
        await ensureTitleFontLoaded(renderedTitleSize, titleFont)
      }

      const subFile = hasSubtitles ? subtitleFilename : null
      const currentTitleRenderLayout = titleText.trim() && renderedVideoDimensions.width > 0
        ? getTitleRenderLayout({
          text: titleText,
          fontSize: renderedTitleSize,
          videoWidth: renderedVideoDimensions.width,
          padding: titlePadding,
          frameWidth: titleFrameWidth,
          lineSpacing: titleLineSpacing,
          fontFamily: titleFont,
          borderWidth: titleBorderWidth,
          align: titleAlign,
        })
        : null

      setStep('Processing and exporting...')
      const result = await exportVideo(
        {
          filename: video.filename,
          aspectRatio: exportAspectRatio,
          outputName: exportFilename.trim() || undefined,
          startTime: hasTrim ? trimStart : undefined,
          endTime: hasTrim ? trimEnd : undefined,
          crop: hasCrop ? crop : undefined,
          audioFilename: audioTrack?.filename,
          audioStartTime: hasAppliedAudioTrim ? appliedAudioTrimStart : undefined,
          audioEndTime: hasAppliedAudioTrim ? appliedAudioTrimEnd : undefined,
          audioOffset: hasAppliedAudio ? appliedAudioOffset : undefined,
          replaceOriginal: hasAppliedAudio ? appliedReplaceOriginal : undefined,
          subtitleFilename: subFile || undefined,
          subtitleStyle: hasSubtitles ? appliedSubtitleStyle || undefined : undefined,
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
          logoFilename: logoImage?.filename,
          logoSize,
          logoX: logoX ?? undefined,
          logoY: logoY ?? undefined,
        },
        (pct) => {
          setExportProgress(pct)
          setStep(`Rendering video... ${pct}%`)
        },
        controller.signal,
      )

      setProcessedUrl(result.url)
      setDone({ url: result.url, downloadUrl: result.downloadUrl })
    } catch (e: unknown) {
      if (controller.signal.aborted) {
        setError('Export cancelled by user.')
      } else {
        setError(e instanceof Error ? e.message : 'Export failed')
      }
    } finally {
      setLoading(false)
      setStep('')
      setExportProgress(0)
      abortControllerRef.current = null
    }
  }

  const handleCancelExport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setLoading(false)
    setExportProgress(0)
    setStep('')
    setError('Export cancelled by user.')
  }


  if (!video) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <p>Import a video first</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 mb-1">Export</h2>
        <p className="text-xs text-zinc-500">Review settings and export your final video</p>
      </div>
      <div className="flex gap-2">
        {([
          { id: 'name', label: 'File name' },
          { id: 'summary', label: 'Summary' },
        ] as const).map(tab => (
          <button type="button"
            key={tab.id}
            onClick={() => setExportTab(tab.id)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${exportTab === tab.id
              ? 'bg-zinc-900 text-white'
              : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {exportTab === 'name' && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700">File name</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={exportFilename}
              onChange={e => setExportFilename(e.target.value)}
              placeholder="my_export"
              className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
            />
            <span className="text-xs text-zinc-500">.mp4</span>
          </div>
        </div>
      )}

      {exportTab === 'summary' && (
        <div className="bg-zinc-50 rounded-xl p-4 space-y-3 border border-zinc-200">
          <h3 className="text-sm font-semibold text-zinc-700">Export summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-zinc-500"><Scissors size={13} /> Trim</span>
              {hasTrim ? (
                <span className="text-zinc-700 font-mono text-xs flex items-center gap-1">
                  <span>{formatTime(trimStart)}</span>
                  <ArrowRight size={12} className="text-zinc-500 shrink-0" />
                  <span>{formatTime(trimEnd)}</span>
                  <span>{`(${formatTime(trimEnd - trimStart)})`}</span>
                </span>
              ) : (
                <span className="text-zinc-700 font-mono text-xs">Full video</span>
              )}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-zinc-500"><CropIcon size={13} /> Crop</span>
              <span className="text-zinc-700 font-mono text-xs">
                {hasCrop
                  ? `T ${Math.round(crop.top * 100)}% · B ${Math.round(crop.bottom * 100)}% · L ${Math.round(crop.left * 100)}% · R ${Math.round(crop.right * 100)}%`
                  : 'None'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-zinc-500"><Music size={13} /> Audio</span>
              {hasAppliedAudio ? (
                <span className="min-w-0 max-w-[75%] flex items-center justify-end gap-1 whitespace-nowrap text-zinc-700 text-xs">
                  <span className="min-w-0 truncate" title={audioTrack!.filename}>
                    {audioTrack!.filename}
                  </span>
                  <span className="shrink-0 flex items-center gap-1">
                    {` (${appliedReplaceOriginal ? 'replace' : 'mix'})`}
                    {hasAppliedAudioTrim ? (
                      <>
                        <span>{`— Trim ${formatTime(appliedAudioTrimStart)}`}</span>
                        <ArrowRight size={12} className="text-zinc-500 shrink-0" />
                        <span>{formatTime(appliedAudioTrimEnd)}</span>
                      </>
                    ) : null}
                    {appliedAudioOffset > 0 ? ` — Offset ${formatTime(appliedAudioOffset)}` : ''}
                  </span>
                </span>
              ) : (
                <span className="text-zinc-700 text-xs">
                  {hasAudio ? 'Not applied' : 'Original'}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-zinc-500"><FileText size={13} /> Subtitles</span>
              <span className="text-zinc-700 text-xs">
                {hasSubtitles ? `${subtitles.length} entries` : 'None'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-zinc-500"><ImageIcon size={13} /> Logo</span>
              {hasLogo ? (
                <span className="min-w-0 max-w-[75%] flex items-center justify-end gap-1 whitespace-nowrap text-zinc-700 text-xs">
                  <span className="min-w-0 truncate" title={logoImage!.filename}>
                    {logoImage!.filename}
                  </span>
                  <span className="shrink-0">
                    {` (${logoSize}%, x:${Math.round((logoX ?? 0) * 100)}%, y:${Math.round((logoY ?? 0) * 100)}%)`}
                  </span>
                </span>
              ) : (
                <span className="text-zinc-700 text-xs">None</span>
              )}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-zinc-500"><Type size={13} /> Title</span>
              <span className="text-zinc-700 text-xs">
                {titleText.trim() ? `${titleText.trim().slice(0, 18)}${titleText.trim().length > 18 ? '…' : ''} (${titleFont}, ${titleSize}px)` : 'None'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-zinc-500"><Square size={13} /> Border</span>
              <span className="text-zinc-700 text-xs">
                {borderEnabled && (borderWidth > 0 || borderHeight > 0)
                  ? `${borderWidth}px × ${borderHeight}px ${borderColor} (outside)`
                  : 'None'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-zinc-500"><Monitor size={13} /> Aspect</span>
              <span className="text-zinc-700 text-xs">
                {exportAspectRatio === 'original' ? 'Original' : exportAspectRatio}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-zinc-500"><FileVideo size={13} /> File name</span>
              <span className="text-zinc-700 text-xs">
                {exportFilename.trim() ? `${exportFilename.trim()}.mp4` : 'Auto'}
              </span>
            </div>
          </div>
        </div>
      )}
      {!done ? (
        loading ? (
          <div className="space-y-3 p-4 rounded-xl border border-cyan-200 bg-cyan-50/50 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold text-cyan-900">
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-cyan-600" />
                {step || 'Processing...'}
              </span>
              <span className="font-mono text-cyan-700 font-bold">{exportProgress}%</span>
            </div>
            <div className="h-2 w-full bg-cyan-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-600 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
            <button
              type="button"
              onClick={handleCancelExport}
              className="w-full py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <X size={14} />
              Cancel export
            </button>
          </div>
        ) : (
          <button type="button"
            onClick={handleExport}
            disabled={loading}
            className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-xl font-semibold text-base transition-colors flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Export video
          </button>
        )
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <CheckCircle2 size={16} />
            Export complete!
          </div>
          <a
            href={done.downloadUrl}
            download={exportFilename.trim() ? `${exportFilename.trim()}.mp4` : undefined}
            className="w-full py-3.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold text-base text-center transition-colors flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Download MP4
          </a>
          <button type="button"
            onClick={() => { setDone(null); setError(null) }}
            className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-sm transition-colors"
          >
            Export again with different settings
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
