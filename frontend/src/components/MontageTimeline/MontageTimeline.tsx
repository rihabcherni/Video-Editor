import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Film, GitMerge, GripVertical, Layers, Loader2, Maximize2, Music, Pause, Play, Scissors, Trash2, Volume2, ZoomIn, ZoomOut} from 'lucide-react'
import { mergeClips } from '../../api/client'
import { useStore } from '../../store/useStore'
import type { MontageAudioClip, MontageClip } from '../../store/useStore'
import { createId } from '../../utils/id'
import { withMediaBase } from '../../utils/media'

const MIN_CLIP_SECONDS = 0.2
const SNAP_SECONDS = 0.35
const TRACK_LEFT = 86
const TRACK_HEIGHT = 48
const AUDIO_HEIGHT = 38
const TRACK_PADDING_TOP = 2
const ABSOLUTE_MIN_ZOOM = 0.05
const MAX_ZOOM = 96
const TARGET_RULER_MARK_PX = 86
const RULER_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600]

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

function formatDurationHMS(s: number) {
  const total = Math.max(0, s)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = Math.floor(total % 60)
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function getRulerStep(pxPerSecond: number) {
  const targetSeconds = TARGET_RULER_MARK_PX / Math.max(pxPerSecond, ABSOLUTE_MIN_ZOOM)
  return RULER_STEPS.find(step => step >= targetSeconds) || RULER_STEPS[RULER_STEPS.length - 1]
}

function formatRulerTime(s: number) {
  if (s < 60) return `${Math.round(s)}s`
  const minutes = Math.floor(s / 60)
  const seconds = Math.round(s % 60)
  if (minutes < 60) return seconds > 0 ? `${minutes}m${seconds.toString().padStart(2, '0')}` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h${remainingMinutes.toString().padStart(2, '0')}` : `${hours}h`
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

function getInsertedVideoLayout(
  clips: MontageClip[],
  activeId: string,
  desiredStart: number,
  activeTrimStart?: number,
  activeTrimEnd?: number,
) {
  const activeClip = clips.find(clip => clip.id === activeId)
  if (!activeClip) return []

  const nextActiveTrimStart = activeTrimStart ?? activeClip.trimStart
  const nextActiveTrimEnd = activeTrimEnd ?? activeClip.trimEnd
  const activeDuration = Math.max(MIN_CLIP_SECONDS, nextActiveTrimEnd - nextActiveTrimStart)
  const orderedOthers = clips
    .filter(clip => clip.id !== activeId)
    .sort((a, b) => clipStart(a) - clipStart(b) || a.order - b.order)

  const desiredCenter = Math.max(0, desiredStart) + activeDuration / 2
  const insertionIndex = orderedOthers.findIndex(clip => {
    const center = clipStart(clip) + clipDuration(clip) / 2
    return desiredCenter < center
  })

  const orderedClips = [...orderedOthers]
  orderedClips.splice(insertionIndex === -1 ? orderedClips.length : insertionIndex, 0, activeClip)

  let cursor = 0
  return orderedClips.map(clip => {
    const isActive = clip.id === activeId
    const duration = isActive ? activeDuration : clipDuration(clip)
    const preferredStart = isActive ? Math.max(0, desiredStart) : clipStart(clip)
    const timelineStart = Math.max(preferredStart, cursor)
    cursor = timelineStart + duration

    return {
      id: clip.id,
      timelineStart,
      order: orderedClips.indexOf(clip),
    }
  })
}

function getInsertedAudioLayout(
  clips: MontageAudioClip[],
  activeId: string,
  desiredStart: number,
  activeTrimStart?: number,
  activeTrimEnd?: number,
) {
  const activeClip = clips.find(clip => clip.id === activeId)
  if (!activeClip) return []

  const nextActiveTrimStart = activeTrimStart ?? activeClip.trimStart
  const nextActiveTrimEnd = activeTrimEnd ?? activeClip.trimEnd
  const activeDuration = Math.max(MIN_CLIP_SECONDS, nextActiveTrimEnd - nextActiveTrimStart)
  const orderedOthers = clips
    .filter(clip => clip.id !== activeId)
    .sort((a, b) => a.offset - b.offset || a.trimStart - b.trimStart)

  const desiredCenter = Math.max(0, desiredStart) + activeDuration / 2
  const insertionIndex = orderedOthers.findIndex(clip => {
    const center = clip.offset + clipDuration(clip) / 2
    return desiredCenter < center
  })

  const orderedClips = [...orderedOthers]
  orderedClips.splice(insertionIndex === -1 ? orderedClips.length : insertionIndex, 0, activeClip)

  let cursor = 0
  return orderedClips.map(clip => {
    const isActive = clip.id === activeId
    const duration = isActive ? activeDuration : clipDuration(clip)
    const preferredStart = isActive ? Math.max(0, desiredStart) : clip.offset
    const offset = Math.max(preferredStart, cursor)
    cursor = offset + duration

    return {
      id: clip.id,
      offset,
    }
  })
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
    <div className="flex h-full min-h-10 items-center justify-center gap-2 rounded-md border border-dashed border-zinc-300 bg-gradient-to-br from-zinc-50 to-white text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      {icon}
      {title}
    </div>
  )
}

export default function MontageTimeline() {
  const {
    montageClips, montageAudioClips,
    removeMontageClip, updateMontageClip, reorderMontageClips,
    removeMontageAudioClip, updateMontageAudioClip, reorderMontageAudioClips,
    clearMontageClips, clearMontageAudioClips,
    mergeLoading, setMergeLoading, mergeStatus, setMergeStatus,
    setMergedVideo, pushActionToast,
    splitMontageClip, splitMontageAudioClip,
  } = useStore()

  const videoRef = useRef<HTMLVideoElement>(null)
  const scrubPreviewVideoRef = useRef<HTMLVideoElement>(null)
  const scrubCanvasRef = useRef<HTMLCanvasElement>(null)
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({})
  const dragRef = useRef<DragState | null>(null)
  const timelineViewportRef = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [playhead, setPlayhead] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [zoom, setZoom] = useState(18)
  const [draggedVideoId, setDraggedVideoId] = useState<string | null>(null)
  const [draggedAudioId, setDraggedAudioId] = useState<string | null>(null)
  const [dropTargetVideoId, setDropTargetVideoId] = useState<string | null>(null)
  const [dropTargetAudioId, setDropTargetAudioId] = useState<string | null>(null)
  const [dropPlacementVideo, setDropPlacementVideo] = useState<'before' | 'after'>('before')
  const [dropPlacementAudio, setDropPlacementAudio] = useState<'before' | 'after'>('before')
  const [draggedListId, setDraggedListId] = useState<string | null>(null)
  const [dropListTargetId, setDropListTargetId] = useState<string | null>(null)
  const [dropListPlacement, setDropListPlacement] = useState<'before' | 'after'>('before')
  const [dropListKind, setDropListKind] = useState<'video' | 'audio' | null>(null)
  const [dragGhost, setDragGhost] = useState<{ kind: 'video' | 'audio'; id: string; x: number; y: number } | null>(null)
  const [hoveredRulerTime, setHoveredRulerTime] = useState<number | null>(null)
  const [scrubPreviewTime, setScrubPreviewTime] = useState<number | null>(null)
  const [autoFit, setAutoFit] = useState(true)
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(0)
  const [activeTrimEditor, setActiveTrimEditor] = useState<{ kind: 'video' | 'audio'; id: string } | null>(null)

  const videoClips = useMemo(
    () => [...montageClips].sort((a, b) => clipStart(a) - clipStart(b) || a.order - b.order),
    [montageClips],
  )

  const audioClips = useMemo(
    () => [...montageAudioClips].sort((a, b) => a.offset - b.offset),
    [montageAudioClips],
  )

  const hasTimelineMedia = videoClips.length > 0 || audioClips.length > 0

  const timelineDuration = useMemo(() => {
    if (!hasTimelineMedia) return 0
    const videoEnd = videoClips.reduce((max, clip) => Math.max(max, clipStart(clip) + clipDuration(clip)), 0)
    const audioEnd = audioClips.reduce((max, clip) => Math.max(max, clip.offset + clipDuration(clip)), 0)
    return Math.max(10, Math.ceil(Math.max(videoEnd, audioEnd)) + 2)
  }, [audioClips, hasTimelineMedia, videoClips])

  const minimumZoom = useMemo(() => {
    const availableWidth = Math.max(120, timelineViewportWidth - TRACK_LEFT - 36)
    const duration = Math.max(1, timelineDuration)
    const durationFactor = duration <= 30
      ? 1
      : duration <= 90
        ? 1.1
        : duration <= 240
          ? 1.25
          : duration <= 600
            ? 1.45
            : 1.75

    return Math.max(ABSOLUTE_MIN_ZOOM, Math.min(MAX_ZOOM, availableWidth / (duration * durationFactor)))
  }, [timelineDuration, timelineViewportWidth])

  const fitZoom = minimumZoom
  const timelineWidth = Math.max(1, Math.ceil(timelineDuration * zoom))
  const timelineContentWidth = autoFit && timelineViewportWidth
    ? timelineViewportWidth
    : Math.max(timelineViewportWidth || 0, timelineWidth + TRACK_LEFT + 24)
  const minVideoBlockWidth = autoFit ? 4 : 36
  const minAudioBlockWidth = autoFit ? 4 : 34

  const activeVideoClip = useMemo(
    () => [...videoClips]
      .reverse()
      .find(clip => playhead >= clipStart(clip) && playhead < clipStart(clip) + clipDuration(clip)) || null,
    [playhead, videoClips],
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

    const clip = [...videoClips]
      .reverse()
      .find(item => next >= clipStart(item) && next < clipStart(item) + clipDuration(item)) || null
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
  }, [audioClips, playing, timelineDuration, videoClips])

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
    const videoEl = videoRef.current
    if (!videoEl) return

    const syncVideoState = () => {
      if (playing && videoEl.paused) {
        void videoEl.play().catch(() => undefined)
      } else if (!playing && !videoEl.paused) {
        videoEl.pause()
      }
    }

    syncVideoState()
  }, [playing])

  useEffect(() => {
    seekPreview(playhead, playing)
  }, [playhead, playing, seekPreview])

  const togglePlay = () => {
    if (!hasTimelineMedia) return
    const nextPlaying = !playing
    setPlaying(nextPlaying)
    seekPreview(playhead >= timelineDuration ? 0 : playhead, nextPlaying)
  }

  const applyVideoLayout = useCallback((clipId: string, desiredStart: number, trimStart: number, trimEnd: number) => {
    const nextStart = Math.max(0, desiredStart)
    const safeTrimStart = Math.max(0, Math.min(trimStart, clipDuration({ id: clipId, video: { id: '', title: '', filename: '', url: '', duration: 0 }, trimStart, trimEnd, timelineStart: 0, order: 0 })))
    const activeClip = videoClips.find(clip => clip.id === clipId)
    if (!activeClip) return

    const safeTrimEnd = Math.max(Math.min(activeClip.video.duration, trimEnd), safeTrimStart + MIN_CLIP_SECONDS)
    const layout = getInsertedVideoLayout(videoClips, clipId, nextStart, safeTrimStart, safeTrimEnd)
    layout.forEach(item => {
      const clip = videoClips.find(candidate => candidate.id === item.id)
      if (!clip) return
      const updates: Partial<Omit<MontageClip, 'id' | 'video'>> = {
        timelineStart: item.timelineStart,
        order: item.order,
      }
      if (item.id === clipId) {
        updates.trimStart = safeTrimStart
        updates.trimEnd = safeTrimEnd
      }
      updateMontageClip(item.id, updates)
    })
  }, [updateMontageClip, videoClips])

  const applyAudioLayout = useCallback((clipId: string, desiredStart: number, trimStart: number, trimEnd: number) => {
    const nextStart = Math.max(0, desiredStart)
    const activeClip = audioClips.find(clip => clip.id === clipId)
    if (!activeClip) return

    const safeTrimStart = Math.max(0, Math.min(trimStart, activeClip.duration))
    const safeTrimEnd = Math.max(Math.min(activeClip.duration, trimEnd), safeTrimStart + MIN_CLIP_SECONDS)
    const layout = getInsertedAudioLayout(audioClips, clipId, nextStart, safeTrimStart, safeTrimEnd)
    layout.forEach(item => {
      const clip = audioClips.find(candidate => candidate.id === item.id)
      if (!clip) return
      const updates: Partial<Omit<MontageAudioClip, 'id'>> = {
        offset: item.offset,
      }
      if (item.id === clipId) {
        updates.trimStart = safeTrimStart
        updates.trimEnd = safeTrimEnd
      }
      updateMontageAudioClip(item.id, updates)
    })
  }, [audioClips, updateMontageAudioClip])

  const handleListReorder = useCallback((kind: 'video' | 'audio', sourceId: string, targetId: string, placement: 'before' | 'after') => {
    if (!sourceId || sourceId === targetId) return
    if (kind === 'video') {
      reorderMontageClips(sourceId, targetId, placement)
      return
    }
    reorderMontageAudioClips(sourceId, targetId, placement)
  }, [reorderMontageAudioClips, reorderMontageClips])

  const updateZoom = (nextZoom: number) => {
    setAutoFit(false)
    setZoom(Math.max(minimumZoom, Math.min(MAX_ZOOM, nextZoom)))
  }

  const zoomIn = () => {
    setAutoFit(false)
    setZoom(current => Math.max(minimumZoom, Math.min(MAX_ZOOM, current * 1.25)))
  }

  const zoomOut = () => {
    setAutoFit(false)
    setZoom(current => Math.max(minimumZoom, Math.min(MAX_ZOOM, current / 1.25)))
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
        const layout = getInsertedVideoLayout(videoClips, drag.id, nextStart)
        layout.forEach(item => updateMontageClip(item.id, { timelineStart: item.timelineStart, order: item.order }))
        const activeItem = layout.find(item => item.id === drag.id)
        seekPreview(activeItem?.timelineStart ?? nextStart, false)
      } else if (drag.kind === 'trim-start') {
        const maxStart = drag.originalTrimEnd - MIN_CLIP_SECONDS
        const nextTrimStart = Math.max(0, Math.min(maxStart, drag.originalTrimStart + deltaSeconds))
        const desiredStart = Math.max(0, drag.originalStart + (nextTrimStart - drag.originalTrimStart))
        const layout = getInsertedVideoLayout(videoClips, drag.id, desiredStart, nextTrimStart, drag.originalTrimEnd)
        layout.forEach(item => updateMontageClip(item.id, {
          timelineStart: item.timelineStart,
          order: item.order,
          ...(item.id === drag.id ? { trimStart: nextTrimStart } : {}),
        }))
        const activeItem = layout.find(item => item.id === drag.id)
        seekPreview(activeItem?.timelineStart ?? desiredStart, false)
      } else {
        const nextTrimEnd = Math.max(drag.originalTrimStart + MIN_CLIP_SECONDS, Math.min(clip.video.duration, drag.originalTrimEnd + deltaSeconds))
        const layout = getInsertedVideoLayout(videoClips, drag.id, drag.originalStart, drag.originalTrimStart, nextTrimEnd)
        layout.forEach(item => updateMontageClip(item.id, {
          timelineStart: item.timelineStart,
          order: item.order,
          ...(item.id === drag.id ? { trimEnd: nextTrimEnd } : {}),
        }))
      }
    } else {
      const clip = audioClips.find(item => item.id === drag.id)
      if (!clip) return

      if (drag.kind === 'move') {
        const nextOffset = snapTime(Math.max(0, drag.originalStart + deltaSeconds), snapEdges)
        const layout = getInsertedAudioLayout(audioClips, drag.id, nextOffset)
        layout.forEach(item => updateMontageAudioClip(item.id, { offset: item.offset }))
      } else if (drag.kind === 'trim-start') {
        const maxStart = drag.originalTrimEnd - MIN_CLIP_SECONDS
        const nextTrimStart = Math.max(0, Math.min(maxStart, drag.originalTrimStart + deltaSeconds))
        const nextOffset = Math.max(0, drag.originalStart + (nextTrimStart - drag.originalTrimStart))
        const layout = getInsertedAudioLayout(audioClips, drag.id, nextOffset, nextTrimStart, drag.originalTrimEnd)
        layout.forEach(item => updateMontageAudioClip(item.id, {
          offset: item.offset,
          ...(item.id === drag.id ? { trimStart: nextTrimStart, trimEnd: drag.originalTrimEnd } : {}),
        }))
      } else {
        const nextTrimEnd = Math.max(drag.originalTrimStart + MIN_CLIP_SECONDS, Math.min(clip.duration, drag.originalTrimEnd + deltaSeconds))
        const layout = getInsertedAudioLayout(audioClips, drag.id, drag.originalStart, drag.originalTrimStart, nextTrimEnd)
        layout.forEach(item => updateMontageAudioClip(item.id, {
          offset: item.offset,
          ...(item.id === drag.id ? { trimEnd: nextTrimEnd } : {}),
        }))
      }
    }
  }, [audioClips, seekPreview, snapEdges, updateMontageAudioClip, updateMontageClip, videoClips, zoom])

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
    const isButtonInteraction = (event.target as HTMLElement | null)?.closest('button')
    if (kind === 'move' && isButtonInteraction) {
      return
    }

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

  const handleRulerHover = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const next = Math.max(0, Math.min(timelineDuration, (event.clientX - rect.left) / zoom))
    setHoveredRulerTime(next)
    setScrubPreviewTime(next)
  }

  const handleRulerLeave = () => {
    setHoveredRulerTime(null)
    setScrubPreviewTime(null)
  }

  const handleMerge = useCallback(async () => {
    if (videoClips.length === 0) return
    
    // Calculate total duration and show warning if very long
    const totalDuration = videoClips.reduce((sum, clip) => sum + clipDuration(clip), 0)
    if (totalDuration > 300) { // 5 minutes
      const proceed = confirm(`This montage is ${formatDurationHMS(totalDuration)} long. Merging may take several minutes and could timeout. Continue anyway?`)
      if (!proceed) return
    }
    
    setMergeLoading(true)
    setMergeStatus('Preparing timeline clips...')
    
    const MAX_RETRIES = 2
    let retryCount = 0
    let lastError: Error | null = null
    
    while (retryCount <= MAX_RETRIES) {
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

        if (retryCount > 0) {
          setMergeStatus(`Retrying merge attempt ${retryCount + 1}/${MAX_RETRIES + 1}...`)
        } else {
          setMergeStatus('Rendering final montage on server... (this may take several minutes for long videos)')
        }
        
        const result = await mergeClips({ clips, audioTracks })
        setMergedVideo({
          id: createId(),
          title: `Montage (${videoClips.length} clips)`,
          duration: videoClips.reduce((sum, clip) => sum + clipDuration(clip), 0),
          url: result.url,
          filename: result.filename,
        })
        clearMontageClips()
        clearMontageAudioClips()
        setMergeStatus(null)
        pushActionToast(`Video generated! You can now add borders, titles, crop, and more.`)
        return // Success, exit the retry loop
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error('Merge failed')
        const errorMessage = lastError.message
        
        // Detect timeout errors - these are worth retrying
        const isTimeoutError = errorMessage.includes('timeout') || errorMessage.includes('504') || errorMessage.includes('Gateway')
        
        if (isTimeoutError && retryCount < MAX_RETRIES) {
          retryCount++
          setMergeStatus(`Timeout detected. Retrying in 3 seconds... (attempt ${retryCount}/${MAX_RETRIES})`)
          await new Promise(resolve => setTimeout(resolve, 3000))
          continue // Retry
        } else {
          // Final error after retries or non-timeout error
          if (isTimeoutError) {
            setMergeStatus('Error: Server timeout after multiple retries. The merge operation took too long. Try reducing the video length or contact support.')
            pushActionToast('Merge timed out after retries. Try with shorter clips or check server configuration.')
          } else {
            setMergeStatus(`Error: ${errorMessage}`)
            pushActionToast(`Merge failed: ${errorMessage}`)
          }
          break // Exit retry loop
        }
      }
    }
    
    setMergeLoading(false)
  }, [audioClips, clearMontageAudioClips, clearMontageClips, pushActionToast, setMergeLoading, setMergeStatus, setMergedVideo, videoClips])

  const handleCutSelection = useCallback(() => {
    if (!selectedId) {
      pushActionToast('Select a clip to cut.')
      return
    }
    
    const videoClip = videoClips.find(clip => clip.id === selectedId)
    const audioClip = audioClips.find(clip => clip.id === selectedId)
    
    if (videoClip) {
      const clipStart = videoClip.timelineStart || videoClip.order || 0
      const clipDuration = videoClip.trimEnd - videoClip.trimStart
      const splitPoint = clipStart + (clipDuration / 2)
      
      if (clipDuration < 0.2) {
        pushActionToast('Clip is too short to split.')
        return
      }
      
      splitMontageClip(selectedId, splitPoint)
      pushActionToast('Video clip split into 2 parts!')
    } else if (audioClip) {
      const clipDuration = audioClip.trimEnd - audioClip.trimStart
      const splitPoint = audioClip.offset + (clipDuration / 2)
      
      if (clipDuration < 0.2) {
        pushActionToast('Clip is too short to split.')
        return
      }
      
      splitMontageAudioClip(selectedId, splitPoint)
      pushActionToast('Audio clip split into 2 parts!')
    }
  }, [selectedId, videoClips, audioClips, splitMontageClip, splitMontageAudioClip, pushActionToast])

  const previewClip = useMemo(() => {
    if (scrubPreviewTime === null) return null
    return [...videoClips].reverse().find(clip => scrubPreviewTime >= clipStart(clip) && scrubPreviewTime < clipStart(clip) + clipDuration(clip)) || null
  }, [scrubPreviewTime, videoClips])

  useEffect(() => {
    const video = scrubPreviewVideoRef.current
    const canvas = scrubCanvasRef.current
    if (!video || !canvas || scrubPreviewTime === null || !previewClip) return

    const mediaTime = previewClip.trimStart + (scrubPreviewTime - clipStart(previewClip))
    const nextSrc = withMediaBase(previewClip.video.url)

    if (video.getAttribute('src') !== nextSrc) {
      video.src = nextSrc
      video.load()
    }

    const drawFrame = () => {
      const context = canvas.getContext('2d')
      if (!context) return
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
    }

    const handleSeeked = () => {
      drawFrame()
      video.removeEventListener('seeked', handleSeeked)
    }

    video.removeEventListener('seeked', handleSeeked)
    video.addEventListener('seeked', handleSeeked)
    if (Math.abs(video.currentTime - mediaTime) > 0.05) {
      video.currentTime = mediaTime
    } else {
      drawFrame()
    }

    const timeout = window.setTimeout(() => {
      drawFrame()
      video.removeEventListener('seeked', handleSeeked)
    }, 120)

    return () => {
      window.clearTimeout(timeout)
      video.removeEventListener('seeked', handleSeeked)
    }
  }, [previewClip, scrubPreviewTime])

  const pxPerSecond = Math.max(ABSOLUTE_MIN_ZOOM, zoom)
  const rulerStep = getRulerStep(pxPerSecond)
  const rulerLabelStep = Math.max(rulerStep, getRulerStep(Math.max(pxPerSecond * 0.7, ABSOLUTE_MIN_ZOOM)))
  const rulerMarks = Array.from({ length: Math.ceil(timelineDuration / rulerStep) + 1 }, (_, i) => i * rulerStep)

  return (
    <div className="h-[calc(100vh)] flex flex-col gap-2">
      <div className="flex-1 grid gap-3 xl:grid-cols-[minmax(450px,1fr)_minmax(400px,0.32fr)] items-stretch min-h-0 w-full">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm flex flex-col min-h-0">
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 flex-shrink-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                <Film size={15} />
              </span>
              <span className="truncate text-sm font-semibold text-zinc-900">Montage preview</span>
            </div>
            <span className="rounded-lg bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-600">{formatDurationHMS(playhead)} - {formatDurationHMS(timelineDuration)}</span>
          </div>
          <div className="relative flex-1 min-h-0 items-center justify-center bg-[linear-gradient(135deg,#f8fafc_0%,#eef2f7_100%)]">
            {activeVideoClip ? (
              <video
                ref={videoRef}
                src={withMediaBase(activeVideoClip.video.url)}
                className="h-full w-full object-contain"
                muted={false}
                onEnded={() => setPlaying(false)}
                onClick={(e) => {
                  e.preventDefault()
                  togglePlay()
                }}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-zinc-400">
                <Maximize2 size={28} />
                <span className="text-xs font-medium">No video at playhead</span>
              </div>
            )}
            {hasTimelineMedia && (
              <button
                type="button"
                onClick={togglePlay}
                className="absolute bottom-4 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-cyan-600 text-white shadow-lg shadow-cyan-600/20 transition-colors hover:bg-cyan-500"
                aria-label={playing ? 'Pause montage preview' : 'Play montage preview'}
              >
                {playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
              </button>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.08)] flex flex-col min-h-0">
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/25">
                <Layers size={18} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Montage</h2>
                <p className="text-xs text-zinc-500">{videoClips.length} video · {audioClips.length} audio</p>
              </div>
            </div>
          <div className="mt-2 flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="flex-1 space-y-2 overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-zinc-300 scrollbar-track-transparent min-h-0">
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Videos</p>
                {videoClips.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-center">
                    <Film size={24} className="mx-auto text-zinc-300 mb-2" />
                    <p className="text-xs text-zinc-500">Add video clips to build your montage</p>
                  </div>
                ) : videoClips.map((clip, index) => {
                  const duration = clipDuration(clip)
                  const isDropTarget = dropListTargetId === clip.id && dropListKind === 'video'
                  const isTrimOpen = activeTrimEditor?.kind === 'video' && activeTrimEditor.id === clip.id
                  const trimMax = clip.video.duration
                  const hasCustomTrim = clip.trimStart > 0 || clip.trimEnd < clip.video.duration
                  const isSelected = selectedId === clip.id
                  return (
                    <div
                      key={clip.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', clip.id)
                        setDraggedListId(clip.id)
                        setDropListKind('video')
                      }}
                      onDragOver={(event) => {
                        event.preventDefault()
                        setDropListTargetId(clip.id)
                        setDropListPlacement(event.clientX > (event.currentTarget.getBoundingClientRect().left + event.currentTarget.getBoundingClientRect().width / 2) ? 'after' : 'before')
                        setDropListKind('video')
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        const sourceId = event.dataTransfer.getData('text/plain') || draggedListId
                        if (sourceId && sourceId !== clip.id) {
                          handleListReorder('video', sourceId, clip.id, dropListPlacement)
                        }
                        setDraggedListId(null)
                        setDropListTargetId(null)
                        setDropListPlacement('before')
                        setDropListKind(null)
                      }}
                      onDragEnd={() => {
                        setDraggedListId(null)
                        setDropListTargetId(null)
                        setDropListPlacement('before')
                        setDropListKind(null)
                      }}
                      onClick={() => setSelectedId(clip.id)}
                      className={`group relative flex flex-col gap-2 p-2 rounded-xl border-2 transition-all duration-300 cursor-pointer ${isSelected
                        ? 'bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-300 shadow-[0_0_0_2px_rgba(8,145,178,0.15),0_4px_12px_rgba(8,145,178,0.2)] ring-2 ring-cyan-200 ring-offset-2'
                        : 'bg-white border-zinc-200 hover:border-zinc-300 hover:shadow-md hover:bg-zinc-50/50'
                        } ${isDropTarget ? 'border-t-4 border-t-cyan-500' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className={`cursor-grab active:cursor-grabbing p-1 -ml-1 rounded-lg transition-colors flex-shrink-0 ${isSelected ? 'bg-cyan-200 hover:bg-cyan-300' : 'hover:bg-zinc-200/50'}`}>
                          <GripVertical size={14} className={isSelected ? 'text-cyan-700' : 'text-zinc-300 group-hover:text-zinc-400'} />
                        </div>

                        <button type="button"
                          onClick={e => {
                            e.stopPropagation()
                            removeMontageClip(clip.id)
                          }}
                          className={`p-1.5 rounded-lg border bg-white/90 backdrop-blur-sm transition-all duration-200 shadow-sm flex-shrink-0 ${isSelected
                            ? 'border-red-200 text-red-500 hover:bg-red-50'
                            : 'border-zinc-100 text-zinc-400 hover:text-red-500 hover:border-red-200'
                            }`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className={`w-full aspect-video rounded-xl overflow-hidden relative group/preview flex-shrink-0 border shadow-sm ring-2 ${isSelected ? 'bg-black border-cyan-500 ring-cyan-400 shadow-[0_0_12px_rgba(8,145,178,0.5)]' : 'bg-black border-zinc-200 ring-zinc-950/5'}`}>
                        <video
                          src={`${withMediaBase(clip.video.url)}#t=${clip.trimStart},${clip.trimEnd}`}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover/preview:scale-110"
                          muted
                          onMouseEnter={e => e.currentTarget.play().catch(() => {})}
                          onMouseLeave={e => {
                            e.currentTarget.pause()
                            e.currentTarget.currentTime = clip.trimStart
                          }}
                          preload="metadata"
                          playsInline
                        />
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider">
                          {formatDurationHMS(duration)}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <p className={`text-[12px] font-bold truncate transition-colors tracking-tight leading-none ${isSelected ? 'text-cyan-900' : 'text-zinc-800'
                          }`}>
                          {clip.video.title || `Clip ${index + 1}`}
                        </p>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border transition-colors ${isSelected ? 'bg-cyan-600 border-cyan-700 text-white' : 'bg-zinc-50 border-zinc-100 text-zinc-500'
                            }`}>
                            <Play size={9} className="fill-current" />
                            {formatDuration(clip.timelineStart)} <span className="opacity-30">—</span> {formatDuration(clip.timelineStart + duration)}
                          </div>

                          {hasCustomTrim && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600">
                              <CheckCircle2 size={10} />
                              <span className="text-[9px] font-bold uppercase tracking-wide">Trimmed</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {isTrimOpen && (
                        <div className="mt-1 rounded-lg bg-gradient-to-r from-cyan-50 to-cyan-100/50 border border-cyan-200 p-2.5">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-700">Trim</span>
                            <span className="text-[9px] font-mono font-medium text-cyan-800">{formatDurationHMS(clip.trimStart)} - {formatDurationHMS(clip.trimEnd)}</span>
                          </div>
                          <div className="space-y-1">
                            <div>
                              <div className="flex justify-between text-[8px] text-zinc-500">
                                <span>Start</span>
                                <span className="font-mono">{formatDurationHMS(clip.trimStart)}</span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={Math.max(clip.trimStart + MIN_CLIP_SECONDS, trimMax)}
                                step={0.1}
                                value={clip.trimStart}
                                onChange={(event) => {
                                  const nextValue = Number(event.target.value)
                                  const safeStart = Math.max(0, Math.min(nextValue, clip.trimEnd - MIN_CLIP_SECONDS))
                                  applyVideoLayout(clip.id, clip.timelineStart, safeStart, clip.trimEnd)
                                }}
                                className="h-1 w-full accent-cyan-600 rounded-full appearance-none cursor-pointer"
                              />
                            </div>
                            <div>
                              <div className="flex justify-between text-[8px] text-zinc-500">
                                <span>End</span>
                                <span className="font-mono">{formatDurationHMS(clip.trimEnd)}</span>
                              </div>
                              <input
                                type="range"
                                min={Math.max(MIN_CLIP_SECONDS, clip.trimStart + MIN_CLIP_SECONDS)}
                                max={trimMax}
                                step={0.1}
                                value={clip.trimEnd}
                                onChange={(event) => {
                                  const nextValue = Number(event.target.value)
                                  const safeEnd = Math.max(clip.trimStart + MIN_CLIP_SECONDS, Math.min(trimMax, nextValue))
                                  applyVideoLayout(clip.id, clip.timelineStart, clip.trimStart, safeEnd)
                                }}
                                className="h-1 w-full accent-cyan-600 rounded-full appearance-none cursor-pointer"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedId(clip.id)
                                setActiveTrimEditor(null)
                              }}
                              className="w-full mt-1 rounded-lg bg-cyan-600 px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-cyan-500"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setActiveTrimEditor(current => current?.kind === 'video' && current.id === clip.id ? null : { kind: 'video', id: clip.id })}
                        className={`w-full rounded-lg px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] transition-colors ${isTrimOpen ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200' : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'}`}
                      >
                        <Scissors size={11} className="inline mr-1" />
                        {isTrimOpen ? 'Hide' : 'Trim'}
                      </button>
                    </div>
                  )
                })}
              </div>

              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Audio</p>
                {audioClips.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-center">
                    <Music size={24} className="mx-auto text-zinc-300 mb-2" />
                    <p className="text-xs text-zinc-500">Add audio tracks to enhance your montage</p>
                  </div>
                ) : audioClips.map((clip, index) => {
                  const duration = clipDuration(clip)
                  const isDropTarget = dropListTargetId === clip.id && dropListKind === 'audio'
                  const isTrimOpen = activeTrimEditor?.kind === 'audio' && activeTrimEditor.id === clip.id
                  const hasCustomTrim = clip.trimStart > 0 || clip.trimEnd < clip.duration
                  const isSelected = selectedId === clip.id
                  return (
                    <div
                      key={clip.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', clip.id)
                        setDraggedListId(clip.id)
                        setDropListKind('audio')
                      }}
                      onDragOver={(event) => {
                        event.preventDefault()
                        setDropListTargetId(clip.id)
                        setDropListPlacement(event.clientX > (event.currentTarget.getBoundingClientRect().left + event.currentTarget.getBoundingClientRect().width / 2) ? 'after' : 'before')
                        setDropListKind('audio')
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        const sourceId = event.dataTransfer.getData('text/plain') || draggedListId
                        if (sourceId && sourceId !== clip.id) {
                          handleListReorder('audio', sourceId, clip.id, dropListPlacement)
                        }
                        setDraggedListId(null)
                        setDropListTargetId(null)
                        setDropListPlacement('before')
                        setDropListKind(null)
                      }}
                      onDragEnd={() => {
                        setDraggedListId(null)
                        setDropListTargetId(null)
                        setDropListPlacement('before')
                        setDropListKind(null)
                      }}
                      onClick={() => setSelectedId(clip.id)}
                      className={`group relative flex flex-col gap-2 p-3 rounded-xl border-2 transition-all duration-300 cursor-pointer ${isSelected
                        ? 'bg-gradient-to-br from-teal-50 to-teal-100 border-teal-300 shadow-[0_0_0_2px_rgba(13,148,136,0.15),0_4px_12px_rgba(13,148,136,0.2)] ring-2 ring-teal-200 ring-offset-2'
                        : 'bg-white border-zinc-100 hover:border-zinc-200 hover:shadow-md hover:bg-zinc-50/50'
                        } ${isDropTarget ? 'border-t-4 border-t-teal-500' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className={`cursor-grab active:cursor-grabbing p-1 -ml-1 rounded-lg transition-colors flex-shrink-0 ${isSelected ? 'bg-teal-200 hover:bg-teal-300' : 'hover:bg-zinc-200/50'}`}>
                          <GripVertical size={14} className={isSelected ? 'text-teal-700' : 'text-zinc-300 group-hover:text-zinc-400'} />
                        </div>

                        <button type="button"
                          onClick={e => {
                            e.stopPropagation()
                            removeMontageAudioClip(clip.id)
                          }}
                          className={`p-1.5 rounded-lg border bg-white/90 backdrop-blur-sm transition-all duration-200 shadow-sm flex-shrink-0 ${isSelected
                            ? 'border-red-200 text-red-500 hover:bg-red-50'
                            : 'border-zinc-100 text-zinc-400 hover:text-red-500 hover:border-red-200'
                            }`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className={`w-full aspect-video bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-xl overflow-hidden relative group/preview flex-shrink-0 border shadow-sm ring-2 flex items-center justify-center ${isSelected ? 'border-teal-500 ring-teal-400 shadow-[0_0_12px_rgba(13,148,136,0.5)]' : 'border-zinc-200 ring-zinc-950/5'}`}>
                        <Music size={32} className="text-zinc-600" />
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider">
                          {formatDurationHMS(duration)}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <p className={`text-[13px] font-bold truncate transition-colors tracking-tight leading-none ${isSelected ? 'text-teal-900' : 'text-zinc-800'
                          }`}>
                          {clip.audio.filename.replace(/\.[^/.]+$/, '') || `Audio ${index + 1}`}
                        </p>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border transition-colors ${isSelected ? 'bg-teal-600 border-teal-700 text-white' : 'bg-zinc-50 border-zinc-100 text-zinc-500'
                            }`}>
                            <Volume2 size={9} />
                            {formatDuration(clip.offset)} <span className="opacity-30">—</span> {formatDuration(clip.offset + duration)}
                          </div>

                          {hasCustomTrim && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600">
                              <CheckCircle2 size={10} />
                              <span className="text-[9px] font-bold uppercase tracking-wide">Trimmed</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {isTrimOpen && (
                        <div className="mt-1 rounded-lg bg-gradient-to-r from-teal-50 to-teal-100/50 border border-teal-200 p-2.5">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-teal-700">Trim</span>
                            <span className="text-[9px] font-mono font-medium text-teal-800">{formatDurationHMS(clip.trimStart)} - {formatDurationHMS(clip.trimEnd)}</span>
                          </div>
                          <div className="space-y-1.5">
                            <div>
                              <div className="flex justify-between text-[8px] text-zinc-500">
                                <span>Start</span>
                                <span className="font-mono">{formatDurationHMS(clip.trimStart)}</span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={clip.duration}
                                step={0.1}
                                value={clip.trimStart}
                                onChange={(event) => {
                                  const nextValue = Number(event.target.value)
                                  const safeStart = Math.max(0, Math.min(nextValue, clip.trimEnd - MIN_CLIP_SECONDS))
                                  applyAudioLayout(clip.id, clip.offset, safeStart, clip.trimEnd)
                                }}
                                className="h-1 w-full accent-teal-600 rounded-full appearance-none cursor-pointer"
                              />
                            </div>
                            <div>
                              <div className="flex justify-between text-[8px] text-zinc-500">
                                <span>End</span>
                                <span className="font-mono">{formatDurationHMS(clip.trimEnd)}</span>
                              </div>
                              <input
                                type="range"
                                min={Math.max(MIN_CLIP_SECONDS, clip.trimStart + MIN_CLIP_SECONDS)}
                                max={clip.duration}
                                step={0.1}
                                value={clip.trimEnd}
                                onChange={(event) => {
                                  const nextValue = Number(event.target.value)
                                  const safeEnd = Math.max(clip.trimStart + MIN_CLIP_SECONDS, Math.min(clip.duration, nextValue))
                                  applyAudioLayout(clip.id, clip.offset, clip.trimStart, safeEnd)
                                }}
                                className="h-1 w-full accent-teal-600 rounded-full appearance-none cursor-pointer"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedId(clip.id)
                                setActiveTrimEditor(null)
                              }}
                              className="w-full mt-1 rounded-lg bg-teal-600 px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-teal-500"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setActiveTrimEditor(current => current?.kind === 'audio' && current.id === clip.id ? null : { kind: 'audio', id: clip.id })}
                        className={`w-full rounded-lg px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] transition-colors ${isTrimOpen ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'}`}
                      >
                        <Scissors size={11} className="inline mr-1" />
                        {isTrimOpen ? 'Hide' : 'Trim'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          {videoClips.length > 0 && (     
            <div className="flex justify-between gap-2 flex-items">
             <button
              type="button"
              onClick={handleMerge}
              disabled={mergeLoading || videoClips.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:from-cyan-400 hover:to-cyan-500 hover:shadow-cyan-500/30 disabled:cursor-not-allowed disabled:from-zinc-200 disabled:to-zinc-200 disabled:shadow-none disabled:text-zinc-400"
            >
              {mergeLoading ? <Loader2 size={14} className="animate-spin" /> : <GitMerge size={14} />}
              Generate Final Video
              </button>
              <button
                type="button"
                onClick={() => { clearMontageClips(); clearMontageAudioClips(); setPlayhead(0); setSelectedId(null) }}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={13} />
                Clear timeline
              </button>    
             </div>
          )}
          {mergeStatus && (
            <div className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${mergeStatus.startsWith('Error') ? 'border-red-200 bg-red-50 text-red-700' : 'border-cyan-200 bg-cyan-50 text-cyan-700'}`}>
              {mergeStatus.startsWith('Error') ? <AlertCircle size={14} /> : <Loader2 size={14} className="animate-spin" />}
              {mergeStatus}
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/80 px-3 py-2">
          <div className="flex items-center gap-2">
            {hasTimelineMedia ? (
              <>
                <button type="button" onClick={togglePlay} className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-white hover:bg-cyan-500" aria-label="Play timeline">
                  {playing ? <Pause size={15} /> : <Play size={15} />}
                </button>
                <span className="font-mono text-xs font-semibold text-zinc-700">{formatDurationHMS(playhead)}</span>
              </>
            ) : (
              <span className="text-xs font-medium text-zinc-500">Add video or audio to enable playback</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCutSelection}
              disabled={videoClips.length === 0 || !selectedId}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-700 transition-colors hover:bg-cyan-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
            >
              <Scissors size={12} />
              Cut Selection
            </button>
            <button type="button" onClick={fitTimeline} className={`h-8 rounded-lg px-3 text-xs font-semibold transition-colors ${autoFit ? 'bg-cyan-600 text-white' : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100'}`}>
              Fit
            </button>
            <button type="button" onClick={zoomOut} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100" aria-label="Zoom out">
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
            <button type="button" onClick={zoomIn} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100" aria-label="Zoom in">
              <ZoomIn size={15} />
            </button>
          </div>
        </div>

        <div ref={timelineViewportRef} className="overflow-x-auto overflow-y-hidden">
          <div className="relative min-w-full p-2 sm:p-3" style={{ width: `${timelineContentWidth}px` }}>
            <div className="sticky left-0 z-20 mb-1 flex h-10 items-end bg-white" style={{ paddingLeft: `${TRACK_LEFT}px` }}>
              <div
                className="relative h-10 cursor-pointer overflow-hidden rounded-t-lg border-b border-zinc-200 bg-[linear-gradient(180deg,#fbfdff_0%,#f8fafc_100%)]"
                style={{ width: `${timelineWidth}px` }}
                onMouseDown={handleRulerPointer}
                onMouseMove={handleRulerHover}
                onMouseLeave={handleRulerLeave}
              >
                {hoveredRulerTime !== null && (
                  <div
                    className="pointer-events-none absolute top-1 z-40 -translate-x-1/2 rounded-full border border-cyan-200 bg-white px-2 py-1 text-[10px] font-semibold text-cyan-700 shadow-lg shadow-cyan-100"
                    style={{ left: `${hoveredRulerTime * zoom}px` }}
                  >
                    {formatRulerTime(hoveredRulerTime)}
                  </div>
                )}
                {scrubPreviewTime !== null && previewClip && (
                  <div
                    className="pointer-events-none absolute top-9 z-40 -translate-x-1/2 overflow-hidden rounded-xl border border-cyan-200 bg-white shadow-[0_18px_36px_rgba(15,23,42,0.16)] transition-all duration-150"
                    style={{ left: `${Math.max(64, Math.min(scrubPreviewTime * zoom, Math.max(64, timelineWidth - 132)))}px`, transform: 'translateX(-50%) translateY(0)', opacity: 1 }}
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.16),transparent_70%)]" />
                    <canvas
                      ref={scrubCanvasRef}
                      width={120}
                      height={68}
                      className="relative h-[68px] w-[120px] object-cover"
                    />
                    <div className="relative border-t border-zinc-100 bg-white/95 px-2 py-1 text-[10px] font-semibold text-cyan-700">
                      {formatRulerTime(scrubPreviewTime)}
                    </div>
                  </div>
                )}
                {rulerMarks.map(mark => {
                  const showLabel = mark === 0 || mark % rulerLabelStep === 0
                  return (
                    <div
                      key={mark}
                      className="absolute bottom-0 top-0"
                      style={{ left: `${mark * zoom}px` }}
                    >
                      <div
                        className="absolute bottom-0 left-0 w-px rounded-full"
                        style={{
                          height: showLabel ? '100%' : '60%',
                          background: showLabel ? 'linear-gradient(180deg, rgba(148,163,184,0.9), rgba(203,213,225,0.4))' : 'rgba(203,213,225,0.7)',
                        }}
                      />
                      {showLabel && (
                        <span className="absolute left-1.5 top-1.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 shadow-sm ring-1 ring-zinc-200">
                          {formatRulerTime(mark)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="relative" style={{ paddingLeft: `${TRACK_LEFT}px` }}>
              <div className="pointer-events-none absolute bottom-0 top-0 z-30 w-[2px] rounded-full bg-cyan-600 shadow-[0_0_0_1px_rgba(8,145,178,0.18),0_0_20px_rgba(6,182,212,0.35)]" style={{ left: `${TRACK_LEFT + playhead * zoom}px` }}>
                <div className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full border border-cyan-300/70 bg-cyan-500/20" />
                <div className="absolute -left-1.5 -top-2 h-3.5 w-3.5 rotate-45 bg-cyan-600" />
              </div>

              <div className="absolute left-0 top-0 z-10 flex h-full w-[80px] flex-col gap-1.5 bg-white pr-2">
                <div className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]" style={{ height: TRACK_HEIGHT }}>
                  <Film size={12.5} className="text-fuchsia-600" /> Video
                </div>
                <div className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]" style={{ height: AUDIO_HEIGHT }}>
                  <Volume2 size={12.5} className="text-teal-600" /> Audio
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="relative overflow-hidden rounded-md border border-zinc-200 bg-gradient-to-b from-zinc-50 to-zinc-100" style={{ height: TRACK_HEIGHT, width: timelineWidth }}>
                  {videoClips.length === 0 ? (
                    <EmptyTrack icon={<Film size={16} />} title="Add videos from Import to build the montage" />
                  ) : videoClips.map((clip, index) => {
                    const start = clipStart(clip)
                    const duration = clipDuration(clip)
                    const isSelected = selectedId === clip.id
                    const blockWidth = Math.max(minVideoBlockWidth, duration * zoom)
                    const compactBlock = blockWidth < 56
                    const theme = getTheme(VIDEO_CLIP_THEMES, index)
                    return (
                      <div
                        key={clip.id}
                        draggable
                        onDragStart={event => {
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData('text/plain', clip.id)
                          setDraggedVideoId(clip.id)
                          setDragGhost({ kind: 'video', id: clip.id, x: event.clientX, y: event.clientY })
                        }}
                        onDragOver={event => {
                          event.preventDefault()
                          const rect = event.currentTarget.getBoundingClientRect()
                          const placement = event.clientX >= rect.left + rect.width / 2 ? 'after' : 'before'
                          setDropTargetVideoId(clip.id)
                          setDropPlacementVideo(placement)
                          setDragGhost(current => current?.id === clip.id && current.kind === 'video' ? { ...current, x: event.clientX, y: event.clientY } : current)
                        }}
                        onDragLeave={() => {
                          if (dropTargetVideoId === clip.id) setDropTargetVideoId(null)
                        }}
                        onDrop={event => {
                          event.preventDefault()
                          const sourceId = event.dataTransfer.getData('text/plain') || draggedVideoId
                          if (sourceId && sourceId !== clip.id) {
                            reorderMontageClips(sourceId, clip.id, dropPlacementVideo)
                          }
                          setDraggedVideoId(null)
                          setDropTargetVideoId(null)
                          setDropPlacementVideo('before')
                          setDragGhost(null)
                        }}
                        onDragEnd={() => {
                          setDraggedVideoId(null)
                          setDropTargetVideoId(null)
                          setDropPlacementVideo('before')
                          setDragGhost(null)
                        }}
                        onMouseDown={event => beginDrag(event, 'video', 'move', clip)}
                        onClick={() => { setSelectedId(clip.id); seekPreview(start, false) }}
                        className="group absolute h-9 cursor-grab overflow-hidden rounded-md border border-white/45 text-left shadow-[0_8px_16px_rgba(15,23,42,0.14)] ring-1 ring-inset ring-white/20 transition-all duration-150 active:cursor-grabbing"
                        style={{
                          left: `${start * zoom}px`,
                          top: `${TRACK_PADDING_TOP}px`,
                          width: `${blockWidth}px`,
                          borderColor: isSelected ? '#0891b2' : theme.border,
                          background: isSelected ? `linear-gradient(135deg, #06b6d4, #0891b2)` : `linear-gradient(135deg, ${theme.bg}, ${theme.border})`,
                          boxShadow: isSelected ? `0 0 0 3px rgba(8,145,178,0.4), 0 0 20px rgba(8,145,178,0.5), 0 12px 24px ${theme.soft}` : `0 8px 18px ${theme.soft}`,
                          zIndex: isSelected ? 4 : index + 1,
                          opacity: draggedVideoId === clip.id ? 0.8 : 1,
                          transform: draggedVideoId === clip.id ? 'translateY(-3px) scale(1.04)' : 'translateY(0) scale(1)',
                          outline: dropTargetVideoId === clip.id ? `2px solid ${dropPlacementVideo === 'after' ? 'rgba(34,211,238,0.9)' : 'rgba(8,145,178,0.8)'}` : 'none',
                          filter: isSelected ? 'brightness(1.1) saturate(1.2)' : 'brightness(1) saturate(1)',
                        }}
                        title={`${clip.video.title} · ${formatDuration(start)} - ${formatDuration(start + duration)}`}
                      >
                        <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 rounded-l-lg" style={{ backgroundColor: isSelected ? '#0891b2' : theme.border }} />
                        <div className="pointer-events-none absolute inset-0 rounded-lg border border-white/20 bg-white/10 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                        <div className="pointer-events-none absolute right-1 top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full border border-white/30 bg-black/25 text-[9px] font-semibold text-white shadow-sm backdrop-blur-sm">
                          {index + 1}
                        </div>
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
                          {!compactBlock && (
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-[11px] font-medium text-white">{clip.video.title || `Clip ${index + 1}`}</p>
                              </div>
                              <p className="font-mono text-[10px] text-white/75">{formatDurationHMS(start)} · {formatDurationHMS(start + duration)}</p>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onMouseDown={event => {
                            event.preventDefault()
                            event.stopPropagation()
                          }}
                          onClick={event => {
                            event.preventDefault()
                            event.stopPropagation()
                            removeMontageClip(clip.id)
                          }}
                          className="absolute right-1.5 top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-slate-900/70 p-1 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-red-500/90"
                          aria-label="Remove video clip"
                        >
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
                ) : (
                  <div className="relative overflow-hidden rounded-lg bg-zinc-50 ring-1 ring-zinc-200" style={{ height: AUDIO_HEIGHT, width: timelineWidth }}>
                    {audioClips.map((clip, index) => {
                      const duration = clipDuration(clip)
                      const isSelected = selectedId === clip.id
                      const blockWidth = Math.max(minAudioBlockWidth, duration * zoom)
                      const compactBlock = blockWidth < 52
                      const theme = getTheme(AUDIO_CLIP_THEMES, index)
                      const bars = getWaveBars(clip.id || clip.audio.filename, compactBlock ? 6 : 18)
                      return (
                        <div
                          key={clip.id}
                          draggable
                          onDragStart={event => {
                            event.dataTransfer.effectAllowed = 'move'
                            event.dataTransfer.setData('text/plain', clip.id)
                            setDraggedAudioId(clip.id)
                            setDragGhost({ kind: 'audio', id: clip.id, x: event.clientX, y: event.clientY })
                          }}
                          onDragOver={event => {
                            event.preventDefault()
                            const rect = event.currentTarget.getBoundingClientRect()
                            const placement = event.clientX >= rect.left + rect.width / 2 ? 'after' : 'before'
                            setDropTargetAudioId(clip.id)
                            setDropPlacementAudio(placement)
                            setDragGhost(current => current?.id === clip.id && current.kind === 'audio' ? { ...current, x: event.clientX, y: event.clientY } : current)
                          }}
                          onDragLeave={() => {
                            if (dropTargetAudioId === clip.id) setDropTargetAudioId(null)
                          }}
                          onDrop={event => {
                            event.preventDefault()
                            const sourceId = event.dataTransfer.getData('text/plain') || draggedAudioId
                            if (sourceId && sourceId !== clip.id) {
                              reorderMontageAudioClips(sourceId, clip.id, dropPlacementAudio)
                            }
                            setDraggedAudioId(null)
                            setDropTargetAudioId(null)
                            setDropPlacementAudio('before')
                            setDragGhost(null)
                          }}
                          onDragEnd={() => {
                            setDraggedAudioId(null)
                            setDropTargetAudioId(null)
                            setDropPlacementAudio('before')
                            setDragGhost(null)
                          }}
                          onMouseDown={event => beginDrag(event, 'audio', 'move', clip)}
                          onClick={() => { setSelectedId(clip.id); seekPreview(clip.offset, false) }}
                          className="group absolute h-7 cursor-grab overflow-hidden rounded-md border border-white/45 text-left shadow-[0_6px_12px_rgba(15,23,42,0.14)] ring-1 ring-inset ring-white/20 transition-all duration-150 active:cursor-grabbing"
                          style={{
                            left: `${clip.offset * zoom}px`,
                            top: '2px',
                            height: 'calc(100% - 4px)',
                            width: `${blockWidth}px`,
                            borderColor: isSelected ? '#0d9488' : theme.border,
                            background: isSelected ? `linear-gradient(135deg, #14b8a6, #0d9488)` : `linear-gradient(135deg, ${theme.bg}, ${theme.border})`,
                            boxShadow: isSelected ? `0 0 0 3px rgba(13,148,136,0.4), 0 0 20px rgba(13,148,136,0.5), 0 12px 24px ${theme.soft}` : `0 8px 18px ${theme.soft}`,
                            zIndex: isSelected ? 4 : index + 1,
                            opacity: draggedAudioId === clip.id ? 0.8 : 1,
                            transform: draggedAudioId === clip.id ? 'translateY(-3px) scale(1.04)' : 'translateY(0) scale(1)',
                            outline: dropTargetAudioId === clip.id ? `2px solid ${dropPlacementAudio === 'after' ? 'rgba(34,211,238,0.9)' : 'rgba(8,145,178,0.8)'}` : 'none',
                            filter: isSelected ? 'brightness(1.15) saturate(1.25)' : 'brightness(1) saturate(1)',
                          }}
                          title={`${clip.audio.filename} · ${formatDuration(clip.offset)} - ${formatDuration(clip.offset + duration)}`}
                        >
                          <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 rounded-l-lg" style={{ backgroundColor: isSelected ? '#0d9488' : theme.border }} />
                          <div className="pointer-events-none absolute inset-0 rounded-lg border border-white/20 bg-white/10 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                          <div className="pointer-events-none absolute right-1 top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full border border-white/30 bg-black/25 text-[9px] font-semibold text-white shadow-sm backdrop-blur-sm">
                            {index + 1}
                          </div>
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
                          <div className="relative z-[1] flex h-full min-w-0 items-center gap-2 px-2.5 py-1">
                            {!compactBlock && <Music size={12} className="shrink-0 text-white/80" />}
                            {!compactBlock && (
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-[11px] font-semibold text-white">{clip.audio.filename.replace(/\.[^/.]+$/, '') || `Audio ${index + 1}`}</p>
                                </div>
                                <p className="font-mono text-[10px] text-white/75">{formatDurationHMS(clip.offset)} · {formatDurationHMS(clip.offset + duration)}</p>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onMouseDown={event => {
                              event.preventDefault()
                              event.stopPropagation()
                            }}
                            onClick={event => {
                              event.preventDefault()
                              event.stopPropagation()
                              removeMontageAudioClip(clip.id)
                            }}
                            className="absolute right-1.5 top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-slate-900/70 p-1 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-red-500/90"
                            aria-label="Remove audio clip"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {dragGhost && (() => {
          const ghostClip = dragGhost.kind === 'video'
            ? videoClips.find(clip => clip.id === dragGhost.id)
            : audioClips.find(clip => clip.id === dragGhost.id)
          if (!ghostClip) return null
          const duration = clipDuration(ghostClip)
          const ghostWidth = dragGhost.kind === 'video'
            ? Math.max(minVideoBlockWidth, duration * zoom)
            : Math.max(minAudioBlockWidth, duration * zoom)
          const ghostHeight = dragGhost.kind === 'video' ? TRACK_HEIGHT - 8 : AUDIO_HEIGHT - 6
          const ghostIndex = dragGhost.kind === 'video'
            ? videoClips.findIndex(clip => clip.id === dragGhost.id)
            : audioClips.findIndex(clip => clip.id === dragGhost.id)
          const ghostTheme = dragGhost.kind === 'video'
            ? getTheme(VIDEO_CLIP_THEMES, ghostIndex)
            : getTheme(AUDIO_CLIP_THEMES, ghostIndex)
          return (
            <div
              className="pointer-events-none fixed z-[70] opacity-90"
              style={{ left: `${dragGhost.x - 24}px`, top: `${dragGhost.y - 16}px`, width: `${ghostWidth}px`, height: `${ghostHeight}px` }}
            >
              <div
                className="h-full w-full rounded-lg border border-white/50 shadow-[0_20px_40px_rgba(15,23,42,0.24)]"
                style={{
                  background: `linear-gradient(135deg, ${ghostTheme.bg}, ${ghostTheme.border})`,
                  transform: 'rotate(-2.5deg) translateY(-2px)',
                  filter: 'brightness(1.08) saturate(1.1) blur(0.2px)',
                }}
              >
                <div className="absolute inset-y-0 left-0 w-1.5 rounded-l-lg" style={{ backgroundColor: ghostTheme.border }} />
                <div className="absolute inset-0 rounded-lg border border-white/20 bg-white/10" />
                <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/30 bg-black/25 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm">
                  {ghostIndex + 1}
                </div>
              </div>
            </div>
          )
        })()}
        <video
          ref={scrubPreviewVideoRef}
          className="hidden"
          preload="auto"
        />
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
    </div>
  )
}
