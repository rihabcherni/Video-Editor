import React, { useState } from 'react'
import { ArrowRight, Plus, Trash2, Upload, FileText } from 'lucide-react'
import { autoSubtitles, createSubtitles, getApiErrorMessage, uploadSubtitle } from '../../api/client'
import { useStore } from '../../store/useStore'
import { SubtitleEntry } from '../../api/client'

function secondsToSRT(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.round((s % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

function srtToSeconds(t: string): number {
  const [hms, ms] = t.replace(',', '.').split('.')
  const [h, m, s] = hms.split(':').map(Number)
  return h * 3600 + m * 60 + s + (parseFloat('0.' + ms) || 0)
}

function getSubtitleSignature(entries: SubtitleEntry[], style: { size: number; color: string; backgroundColor: string }) {
  return JSON.stringify({
    entries,
    style,
  })
}

export default function SubtitleEditor() {
  const { video, trimStart, trimEnd, subtitles, subtitleFilename, setSubtitles, setSubtitleFilename, subtitleStyle,
    setSubtitleStyle, appliedSubtitleStyle, setAppliedSubtitleStyle, subtitleAppliedSignature, setSubtitleAppliedSignature, setPendingPreviewAction } = useStore()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoLoading, setAutoLoading] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [autoLang, setAutoLang] = useState('auto')
  const [autoModel, setAutoModel] = useState<'tiny' | 'base' | 'small' | 'medium' | 'large' | 'large-v2' | 'large-v3' | 'large-v3-turbo'>('small')
  const [autoFast, setAutoFast] = useState(true)
  const [activeMode, setActiveMode] = useState<'manual' | 'import' | 'ai'>('manual')
  const [pendingSrt, setPendingSrt] = useState<File | null>(null)
  const [pendingSubtitleFilename, setPendingSubtitleFilename] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const currentSignature = getSubtitleSignature(subtitles, subtitleStyle)

  const addEntry = () => {
    const last = subtitles[subtitles.length - 1]
    const startSec = last ? srtToSeconds(last.endTime) + 0.5 : 0
    const endSec = startSec + 3
    const newEntry: SubtitleEntry = {
      index: subtitles.length + 1,
      startTime: secondsToSRT(startSec),
      endTime: secondsToSRT(endSec),
      text: 'New subtitle',
    }
    setSubtitles([...subtitles, newEntry])
    setPendingSubtitleFilename(null)
  }

  const updateEntry = (i: number, field: keyof SubtitleEntry, value: string) => {
    const updated = [...subtitles]
    updated[i] = { ...updated[i], [field]: value }
    setSubtitles(updated)
    setPendingSubtitleFilename(null)
  }

  const removeEntry = (i: number) => {
    const updated = subtitles.filter((_, idx) => idx !== i)
      .map((e, idx) => ({ ...e, index: idx + 1 }))
    setSubtitles(updated)
    setPendingSubtitleFilename(null)
  }

  const handleSave = async () => {
    if (subtitles.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const result = await createSubtitles(subtitles)
      setPendingPreviewAction('Subtitles applied successfully.')
      setSubtitleFilename(result.filename)
      setAppliedSubtitleStyle(subtitleStyle)
      setSubtitleAppliedSignature(currentSignature)
      setPendingSubtitleFilename(null)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Save failed'))
    } finally {
      setSaving(false)
    }
  }
  const handleUploadSRT = async (file: File) => {
    setUploadLoading(true)
    setError(null)
    try {
      const result = await uploadSubtitle(file)
      setSubtitles(result.entries)
      setPendingSubtitleFilename(result.filename)
      setPendingSrt(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Upload failed'))
    } finally {
      setUploadLoading(false)
    }
  }
  const handleAutoSubtitles = async () => {
    if (!video) return
    setAutoLoading(true)
    setError(null)
    const hasTrim = trimStart > 0 || trimEnd < video.duration
    try {
      const result = await autoSubtitles({
        videoFilename: video.filename,
        language: autoLang === 'auto' ? undefined : autoLang,
        model: autoModel,
        startTime: hasTrim ? trimStart : undefined,
        endTime: hasTrim ? trimEnd : undefined,
        fast: autoFast,
      })
      setSubtitles(result.entries)
      setPendingSubtitleFilename(result.filename)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Auto subtitles failed'))
    } finally {
      setAutoLoading(false)
    }
  }
  const handleApply = async () => {
    if (subtitles.length === 0) return
    if (pendingSubtitleFilename) {
      setPendingPreviewAction('Subtitles applied successfully.')
      setSubtitleFilename(pendingSubtitleFilename)
      setAppliedSubtitleStyle(subtitleStyle)
      setSubtitleAppliedSignature(currentSignature)
      setPendingSubtitleFilename(null)
      return
    }
    await handleSave()
  }
  const isApplying = saving || autoLoading || uploadLoading
  const hasUnappliedChanges = subtitleAppliedSignature !== currentSignature
    || JSON.stringify(appliedSubtitleStyle) !== JSON.stringify(subtitleStyle)
  const canApply = subtitles.length > 0 && (!!pendingSubtitleFilename || !subtitleFilename || hasUnappliedChanges)
  return (
    <div className="space-y-2">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 mb-1">Subtitles</h2>
        <p className="text-xs text-zinc-500">Choose a method then apply subtitles</p>
      </div>
      <div className="bg-zinc-50 rounded-xl p-2 border border-zinc-200 space-y-1">
        <h3 className="text-sm font-medium text-zinc-700">Style</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className="text-[11px] text-zinc-500">
            Size
            <input
              type="number"
              min={12}
              max={60}
              value={subtitleStyle.size}
              onChange={e => setSubtitleStyle({ ...subtitleStyle, size: Number(e.target.value) || 22 })}
              className="mt-1 w-full bg-white border border-zinc-200 rounded-lg px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-cyan-600"
            />
          </label>
          <label className="text-[11px] text-zinc-500">
            Color
            <input
              type="color"
              value={subtitleStyle.color}
              onChange={e => setSubtitleStyle({ ...subtitleStyle, color: e.target.value })}
              className="mt-1 w-full h-7 bg-white border border-zinc-200 rounded-lg p-0.5"
            />
          </label>
          <label className="text-[11px] text-zinc-500">
            Background
            <input
              type="color"
              value={subtitleStyle.backgroundColor}
              onChange={e => setSubtitleStyle({ ...subtitleStyle, backgroundColor: e.target.value })}
              className="mt-1 w-full h-7 bg-white border border-zinc-200 rounded-lg p-0.5"
            />
          </label>
        </div>
      </div>
      <div className="flex items-center gap-3 text-zinc-500">
        <div className="flex-1 h-px bg-zinc-200" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">Method</span>
        <div className="flex-1 h-px bg-zinc-200" />
      </div>
      <div className="bg-zinc-100 rounded-2xl p-1 border border-zinc-200">
        <div className="grid grid-cols-3 gap-1">
          {[
            { id: 'manual', label: 'Manual' },
            { id: 'import', label: 'Import .srt' },
            { id: 'ai', label: 'AI' },
          ].map(tab => (
            <button type="button"
              key={tab.id}
              onClick={() => setActiveMode(tab.id as typeof activeMode)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${activeMode === tab.id
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {activeMode === 'manual' && (
        <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={addEntry}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Plus size={15} /> Add entry
            </button>
            {subtitles.length > 0 && canApply && (
              <span className="px-2 py-1 text-[10px] font-semibold rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200 self-center">
                Ready
              </span>
            )}
          </div>
        </div>
      )}
      {activeMode === 'import' && (
        <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200 space-y-2">
          <div
            onDrop={e => {
              e.preventDefault()
              setDragOver(false)
              const file = e.dataTransfer.files?.[0]
              if (file) {
                setPendingSrt(file)
                setSubtitleFilename(null)
                setPendingSubtitleFilename(null)
              }
            }}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-2 text-center cursor-pointer transition-all ${dragOver ? 'border-cyan-600 bg-cyan-600/10' : 'border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50'
              }`}
          >
            <Upload size={24} className={`mx-auto mb-2 ${dragOver ? 'text-cyan-600' : 'text-zinc-400'}`} />
            <p className="text-zinc-700 font-medium">{dragOver ? 'Drop file here' : 'Import a .srt file'}</p>
            <p className="text-zinc-500 text-[11px] font-bold">SRT only</p>
            {pendingSrt && (
              <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
                <span className="text-xs text-zinc-500 truncate max-w-[220px]">{pendingSrt.name}</span>
                <span className="px-2 py-1 text-[10px] font-semibold rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">
                  Ready
                </span>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".srt"
              className="hidden"
              aria-label="Upload subtitles file (.srt)"
              onChange={e => {
                const file = e.target.files?.[0] || null
                e.currentTarget.value = ''
                setPendingSrt(file)
                if (file) {
                  setSubtitleFilename(null)
                  setPendingSubtitleFilename(null)
                }
              }}
            />
          </div>
          <button type="button"
            onClick={() => pendingSrt && handleUploadSRT(pendingSrt)}
            disabled={!pendingSrt || uploadLoading}
            className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 disabled:bg-zinc-200 disabled:text-zinc-400 text-zinc-700 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-zinc-200"
          >
            <FileText size={14} />
            {uploadLoading ? 'Loading...' : 'Show list'}
          </button>
        </div>
      )}

      {activeMode === 'ai' && (
        <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200 space-y-2">
          <h3 className="text-sm font-medium text-zinc-700">Auto subtitles</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="text-[11px] text-zinc-500">
              Language
              <select
                value={autoLang}
                onChange={e => setAutoLang(e.target.value)}
                className="mt-1 w-full bg-white border border-zinc-200 rounded-lg px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-cyan-600"
              >
                <option value="auto">Auto detect</option>
                <option value="fr">French</option>
                <option value="en">English</option>
                <option value="ar">Arabic</option>
                <option value="es">Spanish</option>
                <option value="de">German</option>
              </select>
            </label>
            <label className="text-[11px] text-zinc-500">
              Model
              <select
                value={autoModel}
                onChange={e => setAutoModel(e.target.value as typeof autoModel)}
                className="mt-1 w-full bg-white border border-zinc-200 rounded-lg px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-cyan-600"
              >
                <option value="tiny">tiny (fast)</option>
                <option value="base">base</option>
                <option value="small">small (balanced)</option>
                <option value="medium">medium</option>
                <option value="large">large (slow)</option>
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-zinc-500">
            <input
              type="checkbox"
              checked={autoFast}
              onChange={e => setAutoFast(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-300 text-cyan-600 focus:ring-cyan-600"
            />
            Fast mode (less accurate)
          </label>
          <button type="button"
            onClick={handleAutoSubtitles}
            disabled={!video || autoLoading}
            className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 disabled:bg-zinc-200 disabled:text-zinc-400 text-zinc-700 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-zinc-200"
          >
            <FileText size={14} />
            {autoLoading ? 'Generating...' : 'Generate list'}
          </button>
        </div>
      )}

      <button type="button" onClick={handleApply} disabled={!canApply || isApplying} className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
        <FileText size={16} />
        {isApplying ? 'Applying...' : 'Apply subtitles'}
      </button>
      {pendingSubtitleFilename && canApply && (
        <div className="text-xs text-zinc-500 text-center">
          List loaded. Click "Apply subtitles" to preview.
        </div>
      )}
      {subtitles.length === 0 ? (
        <div className="text-center py-4 text-zinc-500">
          <FileText size={24} className="mx-auto mb-2" />
          <p className="text-sm">No subtitles yet. Add an entry or upload a .srt file.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[190px] overflow-y-auto">
          {subtitles.map((entry, i) => (
            <div key={i} className="bg-zinc-50 rounded-xl px-2 py-1 space-y-1 border border-zinc-200">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 font-mono w-4">{entry.index}</span>
                <input
                  type="text"
                  value={entry.startTime}
                  onChange={e => updateEntry(i, 'startTime', e.target.value)}
                  aria-label={`Start time for subtitle ${entry.index}`}
                  className="w-28 shrink-0 bg-white rounded-lg px-2 py-1 text-xs font-mono text-zinc-700 border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-cyan-600"
                />
                <ArrowRight size={12} className="text-zinc-500 shrink-0" />
                <input
                  type="text"
                  value={entry.endTime}
                  onChange={e => updateEntry(i, 'endTime', e.target.value)}
                  aria-label={`End time for subtitle ${entry.index}`}
                  className="w-28 shrink-0 bg-white rounded-lg px-2 py-1 text-xs font-mono text-zinc-700 border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-cyan-600"
                />
                <button type="button" onClick={() => removeEntry(i)}
                  className="p-1 hover:bg-red-500/10 rounded text-red-700 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <textarea value={entry.text} onChange={e => updateEntry(i, 'text', e.target.value)} rows={2}
                aria-label={`Subtitle text for entry ${entry.index}`}
                className="w-full bg-white rounded-2lg p-2 text-sm text-zinc-900 border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-cyan-600 resize-none"
              />
            </div>
          ))}
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
