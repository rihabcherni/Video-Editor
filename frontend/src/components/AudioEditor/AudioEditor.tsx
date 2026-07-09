import React, { useRef, useState, useEffect } from 'react'
import { Music, X, Replace, ArrowRight, Scissors } from 'lucide-react'
import { useStore } from '../../store/useStore'

export default function AudioEditor() {
  const {
    audioTrack, setAudioTrack,
    replaceOriginalAudio, setReplaceOriginalAudio,
    audioDuration, setAudioDuration,
    audioTrimStart, audioTrimEnd, setAudioTrimStart, setAudioTrimEnd,
    audioOffset,
    audioApplied, setAudioApplied, setAppliedAudioSettings,
    appliedReplaceOriginal, appliedAudioTrimStart, appliedAudioTrimEnd, appliedAudioOffset,
    previewLoading,
    setPendingPreviewAction,
  } = useStore()

  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    setCurrentTime(0)
  }, [audioTrack?.id])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    if (audioTrimEnd > 0) {
      if (a.currentTime < audioTrimStart || a.currentTime > audioTrimEnd) {
        a.currentTime = audioTrimStart
        setCurrentTime(audioTrimStart)
      }
    }
  }, [audioTrimStart, audioTrimEnd])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }
  const hasPendingAudioChanges =
    !audioApplied ||
    replaceOriginalAudio !== appliedReplaceOriginal ||
    audioTrimStart !== appliedAudioTrimStart ||
    audioTrimEnd !== appliedAudioTrimEnd ||
    audioOffset !== appliedAudioOffset
  const controlsDisabled = previewLoading

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 mb-1 flex items-center gap-2">
          <Music size={16} />
          Audio editing
        </h3>
        <p className="text-xs text-zinc-500">Trim, adjust settings and apply to preview</p>
      </div>

      {!audioTrack ? (
        <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200 text-center">
          <p className="text-sm text-zinc-500">No audio track loaded</p>
          <p className="text-xs text-zinc-400 mt-1">Upload audio in the Import tab first</p>
        </div>
      ) : (
        <>
          <div className="bg-zinc-50 rounded-xl p-3 space-y-2 border border-zinc-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cyan-600/20 rounded-lg flex items-center justify-center">
                  <Music size={18} className="text-cyan-600" />
                </div>
                <div>
                  <p className="text-[14px] font-medium text-zinc-900">{audioTrack.filename}</p>
                </div>
              </div>
              <button type="button"
                onClick={() => setAudioTrack(null)}
                aria-label="Remove audio track"
                className="p-1.5 hover:bg-zinc-200 rounded-lg transition-colors text-zinc-500 hover:text-zinc-900"
              >
                <X size={16} />
              </button>
            </div>

            <audio
              ref={audioRef}
              controls
              controlsList="noplaybackrate nodownload"
              src={audioTrack.url}
              className="audio-editor-player w-full h-8"
              style={{ height: 32 }}
              onLoadedMetadata={() => {
                const d = audioRef.current?.duration || 0
                if (d > 0) {
                  setAudioDuration(d)
                  if (audioTrimEnd <= 0 || audioTrimStart < 0) {
                    setAudioTrimStart(0)
                    setAudioTrimEnd(d)
                    setAudioApplied(false)
                  } else if (audioTrimEnd > d || audioTrimStart > d) {
                    setAudioTrimStart(Math.max(0, Math.min(audioTrimStart, d)))
                    setAudioTrimEnd(Math.max(0, Math.min(audioTrimEnd, d)))
                    setAudioApplied(false)
                  }
                }
              }}
              onTimeUpdate={() => {
                const a = audioRef.current
                if (!a) return
                if (audioTrimEnd > 0 && a.currentTime >= audioTrimEnd) {
                  a.pause()
                  a.currentTime = audioTrimStart
                  setCurrentTime(audioTrimStart)
                  return
                }
                setCurrentTime(a.currentTime)
              }}
              onPlay={() => {
                const a = audioRef.current
                if (!a) return
                if (audioTrimEnd > 0 && (a.currentTime < audioTrimStart || a.currentTime > audioTrimEnd)) {
                  a.currentTime = audioTrimStart
                  setCurrentTime(audioTrimStart)
                }
              }}
              onSeeking={() => {
                const a = audioRef.current
                if (!a || audioTrimEnd <= 0) return
                if (a.currentTime < audioTrimStart) a.currentTime = audioTrimStart
                if (a.currentTime > audioTrimEnd) a.currentTime = audioTrimEnd
              }}
            />
          </div>

          <div className="bg-zinc-50 rounded-xl p-3 space-y-2 border border-zinc-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-700 flex items-center gap-2">
                <Scissors size={14} />
                Trim
              </h3>
              <p className="text-[12px] text-zinc-500">
                Selection: {formatTime(Math.max(0, audioTrimEnd - audioTrimStart))} ({formatTime(audioTrimStart)}  {formatTime(audioTrimEnd)})
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 w-8">Start</span>
                <input
                  type="range" min={0} max={audioDuration} step={0.1} value={audioTrimStart}
                  onChange={e => {
                    const v = parseFloat(e.target.value)
                    if (v < audioTrimEnd) setAudioTrimStart(v)
                    setAudioApplied(false)
                  }}
                  disabled={controlsDisabled}
                  aria-label="Audio trim start"
                  className="flex-1 accent-yellow-600 h-1 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 w-8">End</span>
                <input
                  type="range" min={0} max={audioDuration} step={0.1} value={audioTrimEnd}
                  onChange={e => {
                    const v = parseFloat(e.target.value)
                    if (v > audioTrimStart) setAudioTrimEnd(v)
                    setAudioApplied(false)
                  }}
                  disabled={controlsDisabled}
                  aria-label="Audio trim end"
                  className="flex-1 accent-yellow-600 h-1 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="relative h-2 bg-zinc-200 rounded-full overflow-hidden mt-1">
              <div
                className="absolute top-0 h-full bg-cyan-600/60 rounded"
                style={{
                  left: `${audioDuration ? (audioTrimStart / audioDuration) * 100 : 0}%`,
                  right: `${audioDuration ? 100 - (audioTrimEnd / audioDuration) * 100 : 0}%`,
                }}
              />
              <div
                className="absolute top-0 h-full w-[2px] bg-zinc-900/70"
                style={{ left: `${audioDuration ? (currentTime / audioDuration) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="bg-zinc-50 rounded-xl p-3 space-y-2 border border-zinc-200">
            <h3 className="text-sm font-medium text-zinc-700 flex items-center gap-2">
              <Replace size={12} />
              Mode
            </h3>
            <div className="flex gap-2">
              <button type="button"
                disabled={controlsDisabled}
                onClick={() => { setReplaceOriginalAudio(false); setAudioApplied(false) }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 disabled:border disabled:border-zinc-200 ${!replaceOriginalAudio
                  ? 'bg-cyan-600 text-white'
                  : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                  }`}
              >
                Mix with original
              </button>
              <button type="button"
                disabled={controlsDisabled}
                onClick={() => { setReplaceOriginalAudio(true); setAudioApplied(false) }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 disabled:border disabled:border-zinc-200 ${replaceOriginalAudio
                  ? 'bg-cyan-600 text-white'
                  : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                  }`}
              >
                Replace original
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <button type="button"
              disabled={previewLoading || !hasPendingAudioChanges}
              onClick={() => {
                if (previewLoading) return
                if (hasPendingAudioChanges) {
                  setPendingPreviewAction('Audio applied successfully.')
                }
                setAppliedAudioSettings({
                  replaceOriginal: replaceOriginalAudio,
                  trimStart: audioTrimStart,
                  trimEnd: audioTrimEnd,
                  offset: audioOffset,
                })
              }}
              className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Music size={16} />
              {previewLoading ? 'Applying...' : 'Apply audio'}
            </button>
            {audioApplied && (
              <div className="bg-blue-50 rounded-xl px-3 py-1 border border-blue-200">
                <p className="flex items-center gap-1 whitespace-nowrap text-[12px] text-blue-700">
                  <span className="font-medium">Applied:</span>
                  <span>{formatTime(appliedAudioTrimStart)}</span>
                  <ArrowRight size={12} className="text-zinc-500 shrink-0" />
                  <span>{formatTime(appliedAudioTrimEnd)}</span>
                  <span>{`· ${appliedReplaceOriginal ? 'replace' : 'mix'}`}</span>
                  {appliedAudioOffset > 0 ? <span>{`· Offset ${formatTime(appliedAudioOffset)}`}</span> : null}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
