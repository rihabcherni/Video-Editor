import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, CheckCircle2, Film, GitMerge, Loader2, Maximize2, Music,
  Pause, Play, Plus, Scissors, Trash2, Volume2, ZoomIn, ZoomOut
} from 'lucide-react'
import { mergeClips } from '../../api/client'
import { useStore } from '../../store/useStore'
import type { MontageAudioClip, MontageClip } from '../../store/useStore'
import { createId } from '../../utils/id'
import { withMediaBase } from '../../utils/media'

const MIN_CLIP_SECONDS = 0.2
const SNAP_SECONDS = 0.35
const TRACK_LEFT = 88
const TRACK_HEIGHT = 48
const AUDIO_HEIGHT = 40
const ABSOLUTE_MIN_ZOOM = 0.05
const MAX_ZOOM = 96

const VIDEO_CLIP_THEMES = [
  { bg: '#d946ef', border: '#a21caf', soft: 'rgba(217,70,239,0.16)' },
  { bg: '#0ea5e9', border: '#0369a1', soft: 'rgba(14,165,233,0.16)' },
  { bg: '#22c55e', border: '#15803d', soft: 'rgba(34,197,94,0.16)' },
  { bg: '#f97316', border: '#c2410c', soft: 'rgba(249,115,22,0.16)' },
  { bg: '#6366f1', border: '#4338ca', soft: 'rgba(99,102,241,0.16)' },
  { bg: '#e11d48', border: '#be123c', soft: 'rgba(225,29,72,0.16)' },
]

const AUDIO_CLIP_THEMES = [
  { bg: '#14b8a6', border: '#0f766e', soft: 'rgba(20,184,166,0.16)' },
  { bg: '#06b6d4', border: '#0e7490', soft: 'rgba(6,182,212,0.16)' },
  { bg: '#84cc16', border: '#4d7c0f', soft: 'rgba(132,204,22,0.16)' },
  { bg: '#f59e0b', border: '#b45309', soft: 'rgba(245,158,11,0.16)' },
  { bg: '#8b5cf6', border: '#6d28d9', soft: 'rgba(139,92,246,0.16)' },
]

function getTheme(themes: typeof VIDEO_CLIP_THEMES, index: number) {
  return themes[index % themes.length]
}

function getWaveBars(seed: string, count: number) {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return Array.from({ length: count }, (_, index) => {
    const value = Math.sin((hash + index * 37) * 0.15)
    return 28 + Math.round(Math.abs(value) * 64)
  })
}

function formatDuration(s: number) {
  const total = Math.max(0, s)
  const minutes = Math.floor(total / 60)
  const seconds = Math.floor(total % 60)
  const tenths = Math.floor((total % 1) * 10)
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`
}

function formatClock(s: number) {
  const total = Math.max(0, Math.floor(s))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function frameLabel(s: number) {
  const frames = Math.round((s % 1) * 30)
  return `${formatClock(s)}:${frames.toString().padStart(2, '0')}`
}

function clipDuration(clip: MontageClip | MontageAudioClip) {
  return Math.max(MIN_CLIP_SECONDS, clip.trimEnd - clip.trimStart)
}

function clipStart(clip: MontageClip) {
  return Math.max(0, clip.timelineStart ?? clip.order ?? 0)
}

function snapTime(value: number, edges: number[]) {
  const nearest = edges.reduce<{ edge: number; distance: number } | null>((best, edge) => {
    const distance = Math.abs(edge - value)
    if (!best || distance < best.distance) return { edge, distance }
    return best
  }, null)

  if (nearest && nearest.distance <= SNAP_SECONDS) return nearest.edge
  return value
}

type DragKind = 'move' | 'trim-start' | 'trim-end'
type DragTarget = 'video' | 'audio'

interface DragState {
  target: DragTarget
  kind: DragKind
  id: string
  startX: number
  originalStart: number
  originalTrimStart: number
  originalTrimEnd: number
}

function EmptyTrack({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex h-full min-h-10 items-center justify-center gap-2 rounded-md border border-dashed border-zinc-300 bg-white/70 text-xs font-medium text-zinc-500">
      {icon}
      {title}
    </div>
  )
}

export default function MontageTimeline() {
  const {
    montageClips, montageAudioClips,
    removeMontageClip, updateMontageClip, updateMontageClipTrim,
    removeMontageAudioClip, updateMontageAudioClip,
    clearMontageClips, clearMontageAudioClips,
    mergeLoading, setMergeLoading, mergeStatus, setMergeStatus,
    setVideo, pushActionToast,
  } = useStore()

  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({})
  const dragRef = useRef<DragState | null>(null)
  const timelineViewportRef = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [playhead, setPlayhead] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [zoom, setZoom] = useState(18)
  const [autoFit, setAutoFit] = useState(true)
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(0)

  const videoClips = useMemo(
    () => [...montageClips].sort((a, b) => clipStart(a) - clipStart(b) || a.order - b.order),
    [montageClips],
  )

  const videoLaneItems = useMemo(() => {
    const laneEnds: number[] = []
    const items = videoClips.map(clip => {
      const start = clipStart(clip)
      const end = start + clipDuration(clip)
      let lane = laneEnds.findIndex(laneEnd => start >= laneEnd)
      if (lane === -1) lane = laneEnds.length
      laneEnds[lane] = end
      return { clip, lane }
    })
    return { items, count: Math.max(1, laneEnds.length) }
  }, [videoClips])

  const audioClips = useMemo(
    () => [...montageAudioClips].sort((a, b) => a.offset - b.offset),
    [montageAudioClips],
  )

  const timelineDuration = useMemo(() => {
    const videoEnd = videoClips.reduce((max, clip) => Math.max(max, clipStart(clip) + clipDuration(clip)), 0)
    const audioEnd = audioClips.reduce((max, clip) => Math.max(max, clip.offset + clipDuration(clip)), 0)
    return Math.max(10, Math.ceil(Math.max(videoEnd, audioEnd)) + 2)
  }, [audioClips, videoClips])

  const minimumZoom = useMemo(() => {
    const availableWidth = Math.max(120, timelineViewportWidth - TRACK_LEFT - 36)
    return Math.max(ABSOLUTE_MIN_ZOOM, Math.min(MAX_ZOOM, availableWidth / Math.max(1, timelineDuration)))
  }, [timelineDuration, timelineViewportWidth])

  const fitZoom = minimumZoom
  const timelineWidth = Math.max(1, Math.ceil(timelineDuration * zoom))
  const timelineContentWidth = autoFit && timelineViewportWidth
    ? timelineViewportWidth
    : Math.max(timelineViewportWidth || 0, timelineWidth + TRACK_LEFT + 24)
  const minVideoBlockWidth = autoFit ? 4 : 36
  const minAudioBlockWidth = autoFit ? 4 : 34

  const activeVideoClip = useMemo(
    () => [...videoLaneItems.items]
      .sort((a, b) => b.lane - a.lane)
      .find(({ clip }) => playhead >= clipStart(clip) && playhead < clipStart(clip) + clipDuration(clip))?.clip || null,
    [playhead, videoLaneItems],
  )

  const selectedClip = useMemo(
    () => videoClips.find(clip => clip.id === selectedId) || audioClips.find(clip => clip.id === selectedId) || null,
    [audioClips, selectedId, videoClips],
  )

  const snapEdges = useMemo(() => {
    const edges = [0, playhead]
    videoClips.forEach(clip => {
      const start = clipStart(clip)
      edges.push(start, start + clipDuration(clip))
    })
    audioClips.forEach(clip => {
      edges.push(clip.offset, clip.offset + clipDuration(clip))
    })
    return edges
  }, [audioClips, playhead, videoClips])

  const seekPreview = useCallback((time: number, shouldPlay = playing) => {
    const next = Math.max(0, Math.min(time, timelineDuration))
    setPlayhead(next)

    const clip = [...videoLaneItems.items]
      .sort((a, b) => b.lane - a.lane)
      .find(({ clip: item }) => next >= clipStart(item) && next < clipStart(item) + clipDuration(item))?.clip || null
    const videoEl = videoRef.current
    if (videoEl && clip) {
      const nextSrc = withMediaBase(clip.video.url)
      const mediaTime = clip.trimStart + (next - clipStart(clip))
      if (videoEl.getAttribute('src') !== nextSrc) {
        videoEl.src = nextSrc
      }
      if (Math.abs(videoEl.currentTime - mediaTime) > 0.15) {
        videoEl.currentTime = Math.min(mediaTime, clip.trimEnd)
      }
      if (shouldPlay) void videoEl.play().catch(() => undefined)
    } else if (videoEl) {
      videoEl.pause()
    }

    audioClips.forEach(clip => {
      const audioEl = audioRefs.current[clip.id]
      if (!audioEl) return
      const inside = next >= clip.offset && next < clip.offset + clipDuration(clip)
      if (!inside) {
        audioEl.pause()
        audioEl.currentTime = clip.trimStart
        return
      }
      const mediaTime = clip.trimStart + (next - clip.offset)
      if (Math.abs(audioEl.currentTime - mediaTime) > 0.25) audioEl.currentTime = mediaTime
      if (shouldPlay) void audioEl.play().catch(() => undefined)
      else audioEl.pause()
    })
  }, [audioClips, playing, timelineDuration, videoLaneItems])

  useEffect(() => {
    if (videoClips.length && !selectedId) setSelectedId(videoClips[0].id)
  }, [selectedId, videoClips])

  useEffect(() => {
    const node = timelineViewportRef.current
    if (!node) return

    const updateWidth = () => setTimelineViewportWidth(node.clientWidth)
    updateWidth()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth)
      return () => window.removeEventListener('resize', updateWidth)
    }

    const observer = new ResizeObserver(updateWidth)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!autoFit) return
    setZoom(fitZoom)
  }, [autoFit, fitZoom])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const delta = (now - last) / 1000
      last = now
      setPlayhead(current => {
        const next = current + delta
        if (next >= timelineDuration) {
          setPlaying(false)
          return timelineDuration
        }
        return next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, timelineDuration])

  useEffect(() => {
    seekPreview(playhead, playing)
  }, [playhead, playing, seekPreview])

  const togglePlay = () => {
    const nextPlaying = !playing
    setPlaying(nextPlaying)
    seekPreview(playhead >= timelineDuration ? 0 : playhead, nextPlaying)
  }

  const updateZoom = (nextZoom: number) => {
    setAutoFit(false)
    setZoom(Math.max(minimumZoom, Math.min(MAX_ZOOM, nextZoom)))
  }

  const fitTimeline = () => {
    setAutoFit(true)
    setZoom(fitZoom)
  }

  const updateDrag = useCallback((event: MouseEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const deltaSeconds = (event.clientX - drag.startX) / zoom

    if (drag.target === 'video') {
      const clip = videoClips.find(item => item.id === drag.id)
      if (!clip) return

      if (drag.kind === 'move') {
        const nextStart = snapTime(Math.max(0, drag.originalStart + deltaSeconds), snapEdges)
        updateMontageClip(drag.id, { timelineStart: nextStart })
        seekPreview(nextStart, false)
      } else if (drag.kind === 'trim-start') {
        const maxStart = drag.originalTrimEnd - MIN_CLIP_SECONDS
        const nextTrimStart = Math.max(0, Math.min(maxStart, drag.originalTrimStart + deltaSeconds))
        updateMontageClip(drag.id, {
          trimStart: nextTrimStart,
          timelineStart: Math.max(0, drag.originalStart + (nextTrimStart - drag.originalTrimStart)),
        })
        seekPreview(Math.max(0, drag.originalStart + (nextTrimStart - drag.originalTrimStart)), false)
      } else {
        const nextTrimEnd = Math.max(drag.originalTrimStart + MIN_CLIP_SECONDS, Math.min(clip.video.duration, drag.originalTrimEnd + deltaSeconds))
        updateMontageClipTrim(drag.id, drag.originalTrimStart, nextTrimEnd)
      }
    } else {
      const clip = audioClips.find(item => item.id === drag.id)
      if (!clip) return

      if (drag.kind === 'move') {
        updateMontageAudioClip(drag.id, { offset: snapTime(Math.max(0, drag.originalStart + deltaSeconds), snapEdges) })
      } else if (drag.kind === 'trim-start') {
        const maxStart = drag.originalTrimEnd - MIN_CLIP_SECONDS
        const nextTrimStart = Math.max(0, Math.min(maxStart, drag.originalTrimStart + deltaSeconds))
        updateMontageAudioClip(drag.id, {
          trimStart: nextTrimStart,
          offset: Math.max(0, drag.originalStart + (nextTrimStart - drag.originalTrimStart)),
        })
      } else {
        updateMontageAudioClip(drag.id, {
          trimEnd: Math.max(drag.originalTrimStart + MIN_CLIP_SECONDS, Math.min(clip.duration, drag.originalTrimEnd + deltaSeconds)),
        })
      }
    }
  }, [audioClips, seekPreview, snapEdges, updateMontageAudioClip, updateMontageClip, updateMontageClipTrim, videoClips, zoom])

  useEffect(() => {
    const stopDrag = () => { dragRef.current = null }
    window.addEventListener('mousemove', updateDrag)
    window.addEventListener('mouseup', stopDrag)
    return () => {
      window.removeEventListener('mousemove', updateDrag)
      window.removeEventListener('mouseup', stopDrag)
    }
  }, [updateDrag])

  const beginDrag = (event: React.MouseEvent, target: DragTarget, kind: DragKind, clip: MontageClip | MontageAudioClip) => {
    event.preventDefault()
    event.stopPropagation()
    setSelectedId(clip.id)
    const originalStart = target === 'video' ? clipStart(clip as MontageClip) : (clip as MontageAudioClip).offset
    dragRef.current = {
      target,
      kind,
      id: clip.id,
      startX: event.clientX,
      originalStart,
      originalTrimStart: clip.trimStart,
      originalTrimEnd: clip.trimEnd,
    }
  }

  const handleRulerPointer = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const next = (event.clientX - rect.left) / zoom
    setPlaying(false)
    seekPreview(next, false)
  }

  const handleMerge = useCallback(async () => {
    if (videoClips.length === 0) return
    setMergeLoading(true)
    setMergeStatus('Preparing timeline clips...')
    try {
      const clips = videoClips.map(c => ({
        filename: c.video.filename,
        startTime: c.trimStart,
        endTime: c.trimEnd,
      }))

      const audioTracks = audioClips.length > 0
        ? audioClips.map(a => ({
          filename: a.audio.filename,
          startTime: a.trimStart > 0 ? a.trimStart : undefined,
          endTime: a.trimEnd < a.duration ? a.trimEnd : undefined,
          offset: a.offset > 0 ? a.offset : undefined,
        }))
        : undefined

      setMergeStatus('Rendering final montage on server...')
      const result = await mergeClips({ clips, audioTracks })
      setVideo({
        id: createId(),
        title: `Montage (${videoClips.length} clips)`,
        duration: videoClips.reduce((sum, clip) => sum + clipDuration(clip), 0),
        url: result.url,
        filename: result.filename,
      })
      clearMontageClips()
      clearMontageAudioClips()
      setMergeStatus(null)
      pushActionToast(`Merged ${videoClips.length} clip${videoClips.length !== 1 ? 's' : ''} into one video.`)
    } catch (err: unknown) {
      setMergeStatus(`Error: ${err instanceof Error ? err.message : 'Merge failed'}`)
    } finally {
      setMergeLoading(false)
    }
  }, [audioClips, clearMontageAudioClips, clearMontageClips, pushActionToast, setMergeLoading, setMergeStatus, setVideo, videoClips])

  const rulerStep = zoom >= 56 ? 1 : zoom >= 32 ? 2 : 5
  const rulerMarks = Array.from({ length: Math.ceil(timelineDuration / rulerStep) + 1 }, (_, i) => i * rulerStep)
  const selectedDuration = selectedClip ? clipDuration(selectedClip) : 0
  const selectedTimelineStart = selectedClip
    ? 'video' in selectedClip ? clipStart(selectedClip) : selectedClip.offset
    : 0

  return (
    <div className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(420px,1fr)_minmax(280px,0.34fr)]">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                <Film size={15} />
              </span>
              <span className="truncate text-sm font-semibold text-zinc-900">Montage preview</span>
            </div>
            <span className="rounded-lg bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-600">{frameLabel(playhead)} / {formatClock(timelineDuration)}</span>
          </div>
          <div className="relative flex h-[32vh] min-h-[280px] items-center justify-center bg-[linear-gradient(135deg,#f8fafc_0%,#eef2f7_100%)]">
            {activeVideoClip ? (
              <video
                ref={videoRef}
                src={withMediaBase(activeVideoClip.video.url)}
                className="h-full w-full object-contain"
                muted={false}
                onEnded={() => setPlaying(false)}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-zinc-400">
                <Maximize2 size={28} />
                <span className="text-xs font-medium">No video at playhead</span>
              </div>
            )}
            <button
              type="button"
              onClick={togglePlay}
              className="absolute bottom-4 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-cyan-600 text-white shadow-lg shadow-cyan-600/20 transition-colors hover:bg-cyan-500"
              aria-label={playing ? 'Pause montage preview' : 'Play montage preview'}
            >
              {playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Montage</h2>
              <p className="text-xs text-zinc-500">{videoClips.length} video clips · {audioClips.length} audio tracks</p>
            </div>
            <button
              type="button"
              onClick={handleMerge}
              disabled={mergeLoading || videoClips.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
            >
              {mergeLoading ? <Loader2 size={14} className="animate-spin" /> : <GitMerge size={14} />}
              Render
            </button>
          </div>

          <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              {selectedClip ? (
                <>
                  <CheckCircle2 size={14} className="text-cyan-600" />
                  <span className="min-w-0 truncate">
                    Selected · {formatDuration(selectedTimelineStart)} to {formatDuration(selectedTimelineStart + selectedDuration)} · {selectedDuration.toFixed(1)}s
                  </span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Select a block in the timeline</span>
                </>
              )}
            </div>
          </div>

          {mergeStatus && (
            <div className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${mergeStatus.startsWith('Error') ? 'border-red-200 bg-red-50 text-red-700' : 'border-cyan-200 bg-cyan-50 text-cyan-700'}`}>
              {mergeStatus.startsWith('Error') ? <AlertCircle size={14} /> : <Loader2 size={14} className="animate-spin" />}
              {mergeStatus}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/80 px-3 py-2">
          <div className="flex items-center gap-2">
            <button type="button" onClick={togglePlay} className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-white hover:bg-cyan-500" aria-label="Play timeline">
              {playing ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <span className="font-mono text-xs font-semibold text-zinc-700">{frameLabel(playhead)}</span>
            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-[11px] font-semibold text-cyan-700">Snap on</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={fitTimeline} className={`h-8 rounded-lg px-3 text-xs font-semibold transition-colors ${autoFit ? 'bg-cyan-600 text-white' : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100'}`}>
              Fit
            </button>
            <button type="button" onClick={() => updateZoom(zoom - 8)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100" aria-label="Zoom out">
              <ZoomOut size={15} />
            </button>
            <input
              type="range"
              min={minimumZoom}
              max={MAX_ZOOM}
              step={0.1}
              value={zoom}
              onChange={event => updateZoom(Number(event.target.value))}
              aria-label="Timeline zoom"
              className="w-28 accent-cyan-600 sm:w-40"
            />
            <button type="button" onClick={() => updateZoom(zoom + 8)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100" aria-label="Zoom in">
              <ZoomIn size={15} />
            </button>
          </div>
        </div>

        <div ref={timelineViewportRef} className="overflow-x-auto overflow-y-hidden">
          <div className="relative min-w-full p-2 sm:p-3" style={{ width: `${timelineContentWidth}px` }}>
            <div className="sticky left-0 z-20 mb-1 flex h-8 items-end bg-white" style={{ paddingLeft: `${TRACK_LEFT}px` }}>
              <div className="relative h-8 cursor-pointer border-b border-zinc-200" style={{ width: `${timelineWidth}px` }} onMouseDown={handleRulerPointer}>
                {rulerMarks.map(mark => (
                  <div key={mark} className="absolute bottom-0 top-0 border-l border-zinc-200" style={{ left: `${mark * zoom}px` }}>
                    <span className="absolute left-1 top-0 font-mono text-[10px] text-zinc-500">{formatClock(mark)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative" style={{ paddingLeft: `${TRACK_LEFT}px` }}>
              <div className="pointer-events-none absolute bottom-0 top-0 z-30 w-px bg-cyan-600 shadow-[0_0_0_1px_rgba(8,145,178,0.18)]" style={{ left: `${TRACK_LEFT + playhead * zoom}px` }}>
                <div className="absolute -left-1.5 -top-2 h-3 w-3 rotate-45 bg-cyan-600" />
              </div>

              <div className="absolute left-0 top-0 z-10 flex h-full w-[80px] flex-col gap-2 bg-white pr-2">
                {Array.from({ length: videoLaneItems.count }, (_, index) => (
                  <div key={index} className="flex items-center gap-1.5 rounded-lg bg-zinc-50 px-2 text-[11px] font-semibold text-zinc-600 ring-1 ring-zinc-200" style={{ height: TRACK_HEIGHT }}>
                    <Film size={13} className="text-fuchsia-600" /> V{index + 1}
                  </div>
                ))}
                {audioClips.length === 0 ? (
                  <div className="flex items-center gap-1.5 rounded-lg bg-zinc-50 px-2 text-[11px] font-semibold text-zinc-600 ring-1 ring-zinc-200" style={{ height: AUDIO_HEIGHT }}>
                    <Volume2 size={13} className="text-teal-600" /> Audio
                  </div>
                ) : audioClips.map((clip, index) => (
                  <div key={clip.id} className="flex items-center gap-1.5 rounded-lg bg-zinc-50 px-2 text-[11px] font-semibold text-zinc-600 ring-1 ring-zinc-200" style={{ height: AUDIO_HEIGHT }}>
                    <Volume2 size={13} className="text-teal-600" /> A{index + 1}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="relative overflow-hidden rounded-lg bg-zinc-50 ring-1 ring-zinc-200" style={{ height: videoLaneItems.count * TRACK_HEIGHT + (videoLaneItems.count - 1) * 8, width: timelineWidth }}>
                  {videoClips.length === 0 ? (
                    <EmptyTrack icon={<Film size={16} />} title="Add videos from Import to build the montage" />
                  ) : videoLaneItems.items.map(({ clip, lane }, index) => {
                    const start = clipStart(clip)
                    const duration = clipDuration(clip)
                    const isSelected = selectedId === clip.id
                    const blockWidth = Math.max(minVideoBlockWidth, duration * zoom)
                    const compactBlock = blockWidth < 56
                    const theme = getTheme(VIDEO_CLIP_THEMES, index)
                    return (
                      <div
                        key={clip.id}
                        onMouseDown={event => beginDrag(event, 'video', 'move', clip)}
                        onClick={() => { setSelectedId(clip.id); seekPreview(start, false) }}
                        className="group absolute h-10 cursor-grab overflow-hidden rounded-lg border text-left shadow-sm transition-all active:cursor-grabbing"
                        style={{
                          left: `${start * zoom}px`,
                          top: `${lane * (TRACK_HEIGHT + 8) + 4}px`,
                          width: `${blockWidth}px`,
                          borderColor: isSelected ? '#0891b2' : theme.border,
                          background: `linear-gradient(135deg, ${theme.bg}, ${theme.border})`,
                          boxShadow: isSelected ? `0 0 0 2px rgba(8,145,178,0.24), 0 10px 22px ${theme.soft}` : `0 8px 18px ${theme.soft}`,
                        }}
                        title={`${clip.video.title} · ${formatDuration(start)} - ${formatDuration(start + duration)}`}
                      >
                        {clip.video.thumbnail ? (
                          <img
                            src={clip.video.thumbnail}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-luminosity"
                            onError={event => {
                              event.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <div
                            className="absolute inset-0 opacity-25"
                            style={{
                              backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.85) 0 10px, rgba(255,255,255,0.25) 10px 12px, transparent 12px 20px)',
                            }}
                          />
                        )}
                        <div className="absolute inset-0 bg-black/10" />
                        <button type="button" onMouseDown={event => beginDrag(event, 'video', 'trim-start', clip)} className="absolute inset-y-1 left-1 z-10 w-1.5 cursor-ew-resize rounded-full bg-white/70 opacity-80 group-hover:opacity-100" aria-label="Trim clip start" />
                        <button type="button" onMouseDown={event => beginDrag(event, 'video', 'trim-end', clip)} className="absolute inset-y-1 right-1 z-10 w-1.5 cursor-ew-resize rounded-full bg-white/70 opacity-80 group-hover:opacity-100" aria-label="Trim clip end" />
                        <div className="relative z-[1] flex h-full min-w-0 items-center gap-2 px-3">
                          {!compactBlock && <Scissors size={13} className="shrink-0 text-white/80" />}
                          {!compactBlock && (
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-white">{clip.video.title || `Clip ${index + 1}`}</p>
                              <p className="font-mono text-[10px] text-white/75">{formatDuration(start)} · {duration.toFixed(1)}s</p>
                            </div>
                          )}
                        </div>
                        <button type="button" onClick={event => { event.stopPropagation(); removeMontageClip(clip.id) }} className="absolute right-1 top-1 rounded bg-white/20 p-0.5 text-white/80 opacity-0 hover:bg-red-500/80 hover:text-white group-hover:opacity-100" aria-label="Remove video clip">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )
                  })}
                </div>

                {audioClips.length === 0 ? (
                  <div className="relative overflow-hidden rounded-lg bg-zinc-50 ring-1 ring-zinc-200" style={{ height: AUDIO_HEIGHT, width: timelineWidth }}>
                    <EmptyTrack icon={<Music size={15} />} title="Audio tracks appear here for sync and trimming" />
                  </div>
                ) : audioClips.map((clip, index) => {
                  const duration = clipDuration(clip)
                  const isSelected = selectedId === clip.id
                  const blockWidth = Math.max(minAudioBlockWidth, duration * zoom)
                  const compactBlock = blockWidth < 52
                  const theme = getTheme(AUDIO_CLIP_THEMES, index)
                  const bars = getWaveBars(clip.id || clip.audio.filename, compactBlock ? 6 : 18)
                  return (
                    <div key={clip.id} className="relative overflow-hidden rounded-lg bg-zinc-50 ring-1 ring-zinc-200" style={{ height: AUDIO_HEIGHT, width: timelineWidth }}>
                      <div
                        onMouseDown={event => beginDrag(event, 'audio', 'move', clip)}
                        onClick={() => { setSelectedId(clip.id); seekPreview(clip.offset, false) }}
                        className="group absolute top-1 h-8 cursor-grab overflow-hidden rounded-lg border active:cursor-grabbing"
                        style={{
                          left: `${clip.offset * zoom}px`,
                          width: `${blockWidth}px`,
                          borderColor: isSelected ? '#0891b2' : theme.border,
                          background: `linear-gradient(135deg, ${theme.bg}, ${theme.border})`,
                          boxShadow: isSelected ? `0 0 0 2px rgba(8,145,178,0.24), 0 10px 22px ${theme.soft}` : `0 8px 18px ${theme.soft}`,
                        }}
                        title={`${clip.audio.filename} · ${formatDuration(clip.offset)} - ${formatDuration(clip.offset + duration)}`}
                      >
                        <div className="absolute inset-x-2 inset-y-1.5 flex items-center gap-[2px] opacity-50">
                          {bars.map((height, barIndex) => (
                            <span
                              key={barIndex}
                              className="w-1 rounded-full bg-white"
                              style={{ height: `${height}%` }}
                            />
                          ))}
                        </div>
                        <div className="absolute inset-0 bg-black/10" />
                        <button type="button" onMouseDown={event => beginDrag(event, 'audio', 'trim-start', clip)} className="absolute inset-y-1 left-1 z-10 w-1.5 cursor-ew-resize rounded-full bg-white/70 opacity-80 group-hover:opacity-100" aria-label="Trim audio start" />
                        <button type="button" onMouseDown={event => beginDrag(event, 'audio', 'trim-end', clip)} className="absolute inset-y-1 right-1 z-10 w-1.5 cursor-ew-resize rounded-full bg-white/70 opacity-80 group-hover:opacity-100" aria-label="Trim audio end" />
                        <div className="relative z-[1] flex h-full min-w-0 items-center gap-2 px-3">
                          {!compactBlock && <Music size={12} className="shrink-0 text-white/80" />}
                          {!compactBlock && (
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-semibold text-white">{clip.audio.filename.replace(/\.[^/.]+$/, '') || `Audio ${index + 1}`}</p>
                              <p className="font-mono text-[10px] text-white/75">{formatDuration(clip.offset)} · {duration.toFixed(1)}s</p>
                            </div>
                          )}
                        </div>
                        <button type="button" onClick={event => { event.stopPropagation(); removeMontageAudioClip(clip.id) }} className="absolute right-1 top-1 rounded bg-white/20 p-0.5 text-white/80 opacity-0 hover:bg-red-500/80 hover:text-white group-hover:opacity-100" aria-label="Remove audio clip">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {audioClips.map(clip => (
          <audio
            key={clip.id}
            ref={node => { audioRefs.current[clip.id] = node }}
            src={withMediaBase(clip.audio.url)}
            preload="auto"
            className="hidden"
          />
        ))}
      </div>

      {videoClips.length > 0 && (
        <button
          type="button"
          onClick={() => { clearMontageClips(); clearMontageAudioClips(); setPlayhead(0); setSelectedId(null) }}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={13} />
          Clear timeline
        </button>
      )}
    </div>
  )
}
