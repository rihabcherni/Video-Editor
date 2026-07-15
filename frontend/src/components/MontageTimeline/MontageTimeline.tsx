import { useCallback, useMemo, useState } from 'react'
import {
  Film, Music, Trash2, GitMerge, Loader2, ChevronLeft, ChevronRight,
  GripVertical, Clock, AlertCircle, CheckCircle2, Volume2, X
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { MontageClip, MontageAudioClip } from '../../store/useStore'
import { mergeClips } from '../../api/client'
import { createId } from '../../utils/id'

function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.floor((s % 1) * 10)
  return `${m}:${sec.toString().padStart(2, '0')}.${ms}`
}

const CLIP_COLORS = [
  { bg: 'bg-violet-500', border: 'border-violet-400', text: 'text-violet-50' },
  { bg: 'bg-sky-500', border: 'border-sky-400', text: 'text-sky-50' },
  { bg: 'bg-emerald-500', border: 'border-emerald-400', text: 'text-emerald-50' },
  { bg: 'bg-amber-500', border: 'border-amber-400', text: 'text-amber-50' },
  { bg: 'bg-rose-500', border: 'border-rose-400', text: 'text-rose-50' },
  { bg: 'bg-cyan-500', border: 'border-cyan-400', text: 'text-cyan-50' },
]

function getClipColor(index: number) {
  return CLIP_COLORS[index % CLIP_COLORS.length]
}

// ─────────────────────────────────────────────
// Video Clip Card
// ─────────────────────────────────────────────
function VideoClipCard({
  clip, index, isDraggingOver, onDragStart, onDragOver, onDrop, onRemove, onTrimUpdate,
}: {
  clip: MontageClip
  index: number
  isDraggingOver: boolean
  onDragStart: (id: string) => void
  onDragOver: (id: string) => void
  onDrop: () => void
  onRemove: (id: string) => void
  onTrimUpdate: (id: string, trimStart: number, trimEnd: number) => void
}) {
  const color = getClipColor(index)
  const duration = clip.video.duration
  const [editing, setEditing] = useState(false)
  const [localStart, setLocalStart] = useState(clip.trimStart)
  const [localEnd, setLocalEnd] = useState(clip.trimEnd)

  const handleApply = () => {
    const s = Math.max(0, Math.min(localStart, duration - 0.1))
    const e = Math.max(s + 0.1, Math.min(localEnd, duration))
    onTrimUpdate(clip.id, s, e)
    setEditing(false)
  }

  return (
    <div
      className={`rounded-xl border-2 transition-all ${color.border} ${isDraggingOver ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-[1.02]' : ''}`}
      onDragOver={e => { e.preventDefault(); onDragOver(clip.id) }}
      onDrop={e => { e.preventDefault(); onDrop() }}
    >
      <div className={`${color.bg} rounded-t-[10px] px-3 py-2 flex items-center gap-2`}>
        <div
          draggable
          onDragStart={() => onDragStart(clip.id)}
          className="cursor-grab active:cursor-grabbing text-white/60 hover:text-white flex-shrink-0"
        >
          <GripVertical size={14} />
        </div>
        <Film size={13} className="text-white/80 flex-shrink-0" />
        <span className={`flex-1 text-xs font-semibold ${color.text} truncate`}>{clip.video.title}</span>
        <span className="text-[10px] text-white/60 flex-shrink-0 font-mono">
          {formatDuration(clip.trimEnd - clip.trimStart)}
        </span>
        <button type="button" onClick={() => onRemove(clip.id)} className="flex-shrink-0 text-white/50 hover:text-red-200 transition-colors">
          <X size={13} />
        </button>
      </div>

      <div className="px-3 py-2 bg-zinc-900 rounded-b-[10px]">
        <div className="relative h-5 bg-zinc-700 rounded-md overflow-hidden">
          <div
            className={`absolute h-full ${color.bg} opacity-40`}
            style={{ left: `${(clip.trimStart / duration) * 100}%`, width: `${((clip.trimEnd - clip.trimStart) / duration) * 100}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[9px] text-zinc-400 font-mono">
              {formatDuration(clip.trimStart)} → {formatDuration(clip.trimEnd)}
            </span>
          </div>
        </div>

        {editing ? (
          <div className="mt-2 space-y-1.5">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Start', val: localStart, setVal: setLocalStart, min: 0, max: () => localEnd - 0.1 },
                { label: 'End', val: localEnd, setVal: setLocalEnd, min: () => localStart + 0.1, max: duration },
              ].map(({ label, val, setVal, min, max }) => (
                <div key={label}>
                  <label className="text-[9px] text-zinc-500 uppercase tracking-wider">{label}</label>
                  <div className="flex items-center gap-1 mt-0.5">
                    <button type="button" onClick={() => setVal(v => Math.max(typeof min === 'function' ? min() : min, v - 1))} className="text-zinc-400 hover:text-white p-0.5"><ChevronLeft size={11} /></button>
                    <span className="text-xs text-zinc-200 font-mono flex-1 text-center">{formatDuration(val)}</span>
                    <button type="button" onClick={() => setVal(v => Math.min(typeof max === 'function' ? max() : max, v + 1))} className="text-zinc-400 hover:text-white p-0.5"><ChevronRight size={11} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button type="button" onClick={handleApply} className="flex-1 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[10px] text-white font-semibold transition-colors">Apply Trim</button>
              <button type="button" onClick={() => { setEditing(false); setLocalStart(clip.trimStart); setLocalEnd(clip.trimEnd) }} className="flex-1 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-[10px] text-zinc-300 font-semibold transition-colors">Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => { setEditing(true); setLocalStart(clip.trimStart); setLocalEnd(clip.trimEnd) }}
            className="mt-1.5 w-full py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors flex items-center justify-center gap-1">
            <Clock size={9} /> Edit Trim
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Audio Clip Card
// ─────────────────────────────────────────────
function AudioClipCard({
  clip, onRemove, onUpdate,
}: {
  clip: MontageAudioClip
  onRemove: (id: string) => void
  onUpdate: (id: string, updates: Partial<Omit<MontageAudioClip, 'id'>>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [localOffset, setLocalOffset] = useState(clip.offset)
  const [localStart, setLocalStart] = useState(clip.trimStart)
  const [localEnd, setLocalEnd] = useState(clip.trimEnd)

  const handleApply = () => {
    const s = Math.max(0, Math.min(localStart, clip.duration - 0.1))
    const e = Math.max(s + 0.1, Math.min(localEnd, clip.duration))
    onUpdate(clip.id, { offset: Math.max(0, localOffset), trimStart: s, trimEnd: e })
    setEditing(false)
  }

  return (
    <div className="rounded-xl border-2 border-blue-500/60 bg-zinc-900">
      <div className="bg-blue-600 rounded-t-[10px] px-3 py-2 flex items-center gap-2">
        <Music size={13} className="text-white/80 flex-shrink-0" />
        <span className="flex-1 text-xs font-semibold text-blue-50 truncate">{clip.audio.filename.replace(/\.[^/.]+$/, '')}</span>
        <span className="text-[10px] text-blue-200 font-mono flex-shrink-0">
          {formatDuration(clip.trimEnd - clip.trimStart)}{clip.offset > 0 ? ` +${formatDuration(clip.offset)}` : ''}
        </span>
        <button type="button" onClick={() => onRemove(clip.id)} className="text-blue-200/60 hover:text-red-300 transition-colors"><X size={13} /></button>
      </div>
      <div className="px-3 py-2">
        <div className="h-5 bg-zinc-700 rounded-md overflow-hidden relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[9px] text-zinc-400 font-mono">
              offset {formatDuration(clip.offset)} · {formatDuration(clip.trimStart)}→{formatDuration(clip.trimEnd)}
            </span>
          </div>
        </div>
        {editing ? (
          <div className="mt-2 space-y-1.5">
            <div>
              <label className="text-[9px] text-zinc-500 uppercase tracking-wider">Timeline Offset (seconds)</label>
              <div className="flex items-center gap-1 mt-0.5">
                <button type="button" onClick={() => setLocalOffset(o => Math.max(0, o - 1))} className="text-zinc-400 hover:text-white p-0.5"><ChevronLeft size={11} /></button>
                <span className="text-xs text-zinc-200 font-mono flex-1 text-center">{formatDuration(localOffset)}</span>
                <button type="button" onClick={() => setLocalOffset(o => o + 1)} className="text-zinc-400 hover:text-white p-0.5"><ChevronRight size={11} /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] text-zinc-500 uppercase">Trim Start</label>
                <div className="flex items-center gap-1 mt-0.5">
                  <button type="button" onClick={() => setLocalStart(s => Math.max(0, s - 1))} className="text-zinc-400 hover:text-white p-0.5"><ChevronLeft size={11} /></button>
                  <span className="text-xs text-zinc-200 font-mono flex-1 text-center">{formatDuration(localStart)}</span>
                  <button type="button" onClick={() => setLocalStart(s => Math.min(localEnd - 0.1, s + 1))} className="text-zinc-400 hover:text-white p-0.5"><ChevronRight size={11} /></button>
                </div>
              </div>
              <div>
                <label className="text-[9px] text-zinc-500 uppercase">Trim End</label>
                <div className="flex items-center gap-1 mt-0.5">
                  <button type="button" onClick={() => setLocalEnd(e => Math.max(localStart + 0.1, e - 1))} className="text-zinc-400 hover:text-white p-0.5"><ChevronLeft size={11} /></button>
                  <span className="text-xs text-zinc-200 font-mono flex-1 text-center">{formatDuration(localEnd)}</span>
                  <button type="button" onClick={() => setLocalEnd(e => Math.min(clip.duration, e + 1))} className="text-zinc-400 hover:text-white p-0.5"><ChevronRight size={11} /></button>
                </div>
              </div>
            </div>
            <div className="flex gap-1.5">
              <button type="button" onClick={handleApply} className="flex-1 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-[10px] text-white font-semibold transition-colors">Apply</button>
              <button type="button" onClick={() => setEditing(false)} className="flex-1 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-[10px] text-zinc-300 font-semibold transition-colors">Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => { setEditing(true); setLocalOffset(clip.offset); setLocalStart(clip.trimStart); setLocalEnd(clip.trimEnd) }}
            className="mt-1.5 w-full py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors flex items-center justify-center gap-1">
            <Clock size={9} /> Edit Offset &amp; Trim
          </button>
        )}
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export default function MontageTimeline() {
  const {
    montageClips, montageAudioClips,
    removeMontageClip, reorderMontageClips, updateMontageClipTrim,
    removeMontageAudioClip, updateMontageAudioClip,
    clearMontageClips, clearMontageAudioClips,
    mergeLoading, setMergeLoading, mergeStatus, setMergeStatus,
    setVideo, pushActionToast,
  } = useStore()

  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const sortedClips = useMemo(
    () => [...montageClips].sort((a, b) => a.order - b.order),
    [montageClips]
  )

  const totalDuration = useMemo(
    () => sortedClips.reduce((sum, c) => sum + Math.max(0, c.trimEnd - c.trimStart), 0),
    [sortedClips]
  )

  const handleDrop = () => {
    if (draggedId && dragOverId && draggedId !== dragOverId) {
      reorderMontageClips(draggedId, dragOverId)
    }
    setDraggedId(null)
    setDragOverId(null)
  }

  const handleMerge = useCallback(async () => {
    if (sortedClips.length === 0) return
    setMergeLoading(true)
    setMergeStatus('Preparing clips…')
    try {
      const clips = sortedClips.map(c => ({
        filename: c.video.filename,
        startTime: c.trimStart,
        endTime: c.trimEnd,
      }))

      const audioTracks = montageAudioClips.length > 0
        ? montageAudioClips.map(a => ({
            filename: a.audio.filename,
            startTime: a.trimStart > 0 ? a.trimStart : undefined,
            endTime: a.trimEnd < a.duration ? a.trimEnd : undefined,
            offset: a.offset > 0 ? a.offset : undefined,
          }))
        : undefined

      setMergeStatus('Merging clips on server… this may take a moment')
      const result = await mergeClips({ clips, audioTracks })

      setVideo({
        id: createId(),
        title: `Montage (${sortedClips.length} clips)`,
        duration: totalDuration,
        url: result.url,
        filename: result.filename,
      })

      clearMontageClips()
      clearMontageAudioClips()
      setMergeStatus(null)
      pushActionToast(`✓ Merged ${sortedClips.length} clip${sortedClips.length !== 1 ? 's' : ''} into one video`)
    } catch (err: unknown) {
      setMergeStatus(`Error: ${err instanceof Error ? err.message : 'Merge failed'}`)
    } finally {
      setMergeLoading(false)
    }
  }, [sortedClips, montageAudioClips, totalDuration, setMergeLoading, setMergeStatus, setVideo, clearMontageClips, clearMontageAudioClips, pushActionToast])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 mb-0.5">Montage</h2>
        <p className="text-xs text-zinc-500">Arrange and trim multiple video and audio clips, then merge them into one video.</p>
      </div>

      {/* VIDEO TRACK */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-950 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Film size={14} className="text-violet-400" />
            <span className="text-xs font-semibold text-zinc-300">Video Track</span>
            {sortedClips.length > 0 && (
              <span className="text-[10px] text-zinc-500 font-mono">
                {sortedClips.length} clip{sortedClips.length !== 1 ? 's' : ''} · {formatDuration(totalDuration)}
              </span>
            )}
          </div>
        </div>

        <div className="p-3">
          {sortedClips.length === 0 ? (
            <div className="border-2 border-dashed border-zinc-800 rounded-xl p-8 text-center bg-zinc-950">
              <Film size={24} className="mx-auto mb-2 text-zinc-700" />
              <p className="text-xs text-zinc-400 font-medium">No video clips on timeline</p>
              <p className="text-[10px] text-zinc-500 mt-1">Go to the <strong>Import</strong> tab and click <strong>"+"</strong> on any video in your Media Library to add it here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedClips.map((clip, index) => (
                <VideoClipCard
                  key={clip.id} clip={clip} index={index}
                  isDraggingOver={dragOverId === clip.id}
                  onDragStart={id => setDraggedId(id)}
                  onDragOver={id => setDragOverId(id)}
                  onDrop={handleDrop}
                  onRemove={removeMontageClip}
                  onTrimUpdate={updateMontageClipTrim}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AUDIO TRACK */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-950 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Volume2 size={14} className="text-blue-400" />
            <span className="text-xs font-semibold text-zinc-300">Audio Tracks</span>
            {montageAudioClips.length > 0 && (
              <span className="text-[10px] text-zinc-500">{montageAudioClips.length} track{montageAudioClips.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>

        <div className="p-3">
          {montageAudioClips.length === 0 ? (
            <div className="border border-dashed border-zinc-800 rounded-xl p-5 text-center bg-zinc-950">
              <Music size={16} className="mx-auto mb-1.5 text-zinc-700" />
              <p className="text-[10px] text-zinc-400">Optional background tracks</p>
              <p className="text-[9px] text-zinc-500 mt-0.5">Click <strong>"+"</strong> on any audio asset in the <strong>Import</strong> tab to mix music or voiceovers here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {montageAudioClips.map(clip => (
                <AudioClipCard key={clip.id} clip={clip} onRemove={removeMontageAudioClip} onUpdate={updateMontageAudioClip} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* STATUS */}
      {mergeStatus && (
        <div className={`rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${mergeStatus.startsWith('Error') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
          {mergeStatus.startsWith('Error') ? <AlertCircle size={15} className="flex-shrink-0" /> : <Loader2 size={15} className="animate-spin flex-shrink-0" />}
          {mergeStatus}
        </div>
      )}

      {/* SUMMARY + MERGE BUTTON */}
      <div className="space-y-2">
        {sortedClips.length > 0 && (
          <div className="rounded-xl bg-zinc-100 border border-zinc-200 px-4 py-3 text-sm text-zinc-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
              <span>
                <strong className="text-zinc-800">{sortedClips.length}</strong> video clip{sortedClips.length !== 1 ? 's' : ''}
                {montageAudioClips.length > 0 && <> + <strong className="text-zinc-800">{montageAudioClips.length}</strong> audio track{montageAudioClips.length !== 1 ? 's' : ''}</>}
                {' '}&rarr; <strong className="text-zinc-800">{formatDuration(totalDuration)}</strong> total
              </span>
            </div>
          </div>
        )}

        <button
          type="button" onClick={handleMerge}
          disabled={mergeLoading || sortedClips.length === 0}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white shadow-lg shadow-violet-500/20"
        >
          {mergeLoading ? <><Loader2 size={16} className="animate-spin" /> Merging…</> : <><GitMerge size={16} /> Merge All Into One Video</>}
        </button>

        {sortedClips.length > 0 && (
          <button type="button" onClick={() => { clearMontageClips(); clearMontageAudioClips() }}
            className="w-full py-2 rounded-xl text-xs text-zinc-500 hover:text-red-500 hover:bg-red-50 border border-zinc-200 hover:border-red-200 transition-all flex items-center justify-center gap-1">
            <Trash2 size={12} /> Clear All Clips
          </button>
        )}
      </div>
    </div>
  )
}
