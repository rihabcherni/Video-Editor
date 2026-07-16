import React, { useRef, useState } from 'react'
import { Upload, Loader2, Download, Trash2, Plus, Film, Music, Image as ImageIcon } from 'lucide-react'
import { useStore } from '../../store/useStore'
import {
  uploadVideo, uploadAudio, downloadFromUrl, downloadAudioFromUrl, getApiErrorMessage
} from '../../api/client'
import { createId } from '../../utils/id'

function formatDuration(s: number) {
  if (!s || !Number.isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function isValidUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export default function ImportPanel() {
  const {
    mediaAssets, addMediaAsset, removeMediaAsset,
    addMontageClip, addMontageAudioClip, setActiveTab,
    pushActionToast
  } = useStore()

  const [uploadTab, setUploadTab] = useState<'file' | 'link'>('file')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return

    setLoading(true)
    setError(null)
    setUploadProgress(0)

    const importedCount: string[] = []
    const invalidFiles: string[] = []
    const failedFiles: string[] = []

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      const isVideo = file.type.startsWith('video/')
      const isAudio = file.type.startsWith('audio/')

      const progressOffset = (index / files.length) * 100
      const progressScale = 100 / files.length

      if (!isVideo && !isAudio) {
        invalidFiles.push(file.name)
        setUploadProgress(Math.round(progressOffset))
        continue
      }

      try {
        if (isVideo) {
          const info = await uploadVideo(file, value => setUploadProgress(Math.round(progressOffset + value * progressScale / 100)))
          addMediaAsset({
            id: createId(),
            type: 'video',
            title: file.name.replace(/\.[^/.]+$/, ''),
            filename: info.filename,
            url: info.url,
            duration: info.duration,
            thumbnail: info.thumbnail
          })
        } else {
          const result = await uploadAudio(file)
          const duration = await getAudioDuration(result.url)
          addMediaAsset({
            id: createId(),
            type: 'audio',
            title: file.name.replace(/\.[^/.]+$/, ''),
            filename: result.filename,
            url: result.url,
            duration
          })
        }
        importedCount.push(file.name)
      } catch (err: unknown) {
        failedFiles.push(`${file.name}: ${getApiErrorMessage(err, 'Upload failed')}`)
      }
    }

    setUploadProgress(100)
    setLoading(false)

    if (importedCount.length > 0) {
      pushActionToast(`${importedCount.length} asset${importedCount.length > 1 ? 's' : ''} imported successfully!`)
    }

    if (invalidFiles.length > 0) {
      setError(`Invalid files: ${invalidFiles.join(', ')}.`)
    } else if (failedFiles.length > 0) {
      setError(failedFiles.join(' '))
    }
  }

  const handleUrlDownload = async () => {
    const urls = urlInput
      .split(/\s+/)
      .map(url => url.trim())
      .filter(Boolean)

    if (urls.length === 0) return

    const urlEntries = urls.map(url => ({
      url,
      valid: isValidUrl(url)
    }))

    const validUrls = urlEntries.filter(entry => entry.valid).map(entry => entry.url)
    const invalidUrls = urlEntries.filter(entry => !entry.valid).map(entry => entry.url)

    if (validUrls.length === 0) {
      setError('No valid links found. Please paste valid http or https URLs.')
      return
    }

    setLoading(true)
    setError(null)

    const importedCount: string[] = []
    const failedUrls: string[] = []

    for (let index = 0; index < validUrls.length; index += 1) {
      const url = validUrls[index]
      const isAudioLink = url.includes('.mp3') || url.includes('.wav') || url.includes('.ogg')

      try {
        if (isAudioLink) {
          const result = await downloadAudioFromUrl(url)
          const duration = await getAudioDuration(result.url)
          addMediaAsset({
            id: createId(),
            type: 'audio',
            title: result.filename.replace(/\.[^/.]+$/, ''),
            filename: result.filename,
            url: result.url,
            duration
          })
        } else {
          const info = await downloadFromUrl(url)
          addMediaAsset({
            id: createId(),
            type: 'video',
            title: info.title,
            filename: info.filename,
            url: info.url,
            duration: info.duration,
            thumbnail: info.thumbnail
          })
        }
        importedCount.push(url)
      } catch (err: unknown) {
        failedUrls.push(`${url}: ${getApiErrorMessage(err, 'Download failed')}`)
      }
    }

    setLoading(false)

    if (importedCount.length > 0) {
      pushActionToast(`${importedCount.length} link${importedCount.length > 1 ? 's' : ''} imported successfully!`)
      setUrlInput('')
    }

    if (invalidUrls.length > 0) {
      setError(`Invalid link${invalidUrls.length > 1 ? 's' : ''}: ${invalidUrls.join(', ')}.`)
    } else if (failedUrls.length > 0) {
      setError(failedUrls.join(' '))
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : []
    if (files.length > 0) handleFiles(files)
  }

  const addToTimeline = (asset: typeof mediaAssets[0]) => {
    if (asset.type === 'video') {
      addMontageClip({
        id: createId(),
        title: asset.title,
        filename: asset.filename,
        url: asset.url,
        duration: asset.duration,
        thumbnail: asset.thumbnail
      }, asset.duration)
      pushActionToast(`Added "${asset.title}" to video timeline`)
    } else {
      addMontageAudioClip({
        id: createId(),
        filename: asset.filename,
        url: asset.url
      }, asset.duration)
      pushActionToast(`Added "${asset.title}" to audio timeline`)
    }
    setActiveTab('montage')
  }

  return (
    <div className="space-y-6 min-w-0 w-full overflow-hidden">
      <div className="grid gap-4">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-base font-semibold text-slate-900">Importer un média (audio et vidéo)</p>
              <p className="mt-1 text-sm text-slate-500">
                Glisser-déposer un fichier local ou coller des liens publics pour importer rapidement du contenu dans votre projet.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['YouTube', 'Instagram', 'Facebook', 'TikTok', 'Local'].map(source => (
                  <span key={source} className="rounded-full border border-slate-700/80 bg-cyan-600 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                    {source}
                  </span>
                ))}
              </div>
            </div>
            <div className="inline-flex rounded-full bg-slate-100 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setUploadTab('file')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${uploadTab === 'file' ? 'bg-cyan-600 text-white shadow' : 'bg-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-50'} ${uploadTab === 'file' ? '' : 'border border-slate-200'}`}
              >
                Fichier local
              </button>
              <button
                type="button"
                onClick={() => setUploadTab('link')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${uploadTab === 'link' ? 'bg-cyan-600 text-white shadow' : 'bg-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-50'} ${uploadTab === 'link' ? '' : 'border border-slate-200'}`}
              >
                URL publique
              </button>
            </div>
          </div>

          <div className="mt-5">
            {uploadTab === 'file' ? (
              <div
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`group rounded-[1.75rem] border border-dashed p-8 text-center transition ${dragOver ? 'border-cyan-500 bg-cyan-50' : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*,audio/*"
                  multiple
                  className="hidden"
                  onChange={e => {
                    const files = e.target.files ? Array.from(e.target.files) : []
                    if (files.length > 0) handleFiles(files)
                  }}
                />
                {loading ? (
                  <div className="space-y-3">
                    <Loader2 className="mx-auto text-cyan-600 animate-spin" size={32} />
                    <p className="text-base font-semibold text-slate-900">Import en cours...</p>
                    {uploadProgress > 0 && (
                      <div className="mx-auto mt-4 w-full max-w-xl overflow-hidden rounded-full bg-slate-200 h-2">
                        <div className="h-full bg-cyan-600 transition-all" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <Upload size={32} className="mx-auto mb-4 text-slate-400 transition group-hover:text-cyan-600" />
                    <p className="text-base font-semibold text-slate-900">Déposez vos fichiers ici</p>
                    <p className="mt-2 text-sm text-slate-500">
                      MP4, MOV, MKV, MP3, WAV, AAC
                    </p>
                    <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-400">Cliquez ou glissez pour importer</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4 shadow-sm">
                  <label htmlFor="import-url" className="block text-xs font-semibold text-slate-600 mb-2">
                    Coller un ou plusieurs liens publics
                  </label>
                  <textarea
                    id="import-url"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    placeholder="YouTube, Instagram, Facebook, TikTok ou URL directe audio/vidéo"
                    rows={3}
                    disabled={loading}
                    className="w-full resize-none rounded-3xl border border-slate-200 bg-white py-4 px-4 text-sm text-slate-700 focus:outline-none focus:border-cyan-500 placeholder:text-slate-400"
                  />
                  <p className="mt-3 text-xs text-slate-500">Séparez plusieurs liens par un saut de ligne ou un espace.</p>
                </div>
                <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Aperçu des liens</p>
                    <span className="text-xs text-slate-400">Valide / invalide</span>
                  </div>
                  <div className="mt-2 space-y-2 max-h-40 overflow-y-auto pr-1">
                    {urlInput.trim() ? (
                      urlInput
                        .split(/\s+/)
                        .map(url => url.trim())
                        .filter(Boolean)
                        .map((url, index) => {
                          const valid = isValidUrl(url)
                          return (
                            <div
                              key={index}
                              className={`flex items-center justify-between rounded-2xl px-4 py-3 ring-1 ${valid ? 'bg-cyan-50 ring-cyan-100' : 'bg-white ring-slate-200'}`}
                            >
                              <span className={`truncate text-sm ${valid ? 'text-slate-900' : 'text-slate-700'}`}>{url}</span>
                              {!valid && (
                                <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-600">
                                  Invalide
                                </span>
                              )}
                            </div>
                          )
                        })
                    ) : (
                      <p className="text-sm text-slate-500">Collez des liens pour voir l’aperçu avant import.</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleUrlDownload}
                  disabled={loading || !urlInput.trim()}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 p-3 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:bg-zinc-200 disabled:text-zinc-400"
                >
                  {loading ? <><Loader2 size={14} className="animate-spin" /> Fetching media...</> : <><Download size={14} /> Fetch media</>}
                </button>
              </div>
            )}

            {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Library Assets ({mediaAssets.length})</p>
              <p className="mt-1 text-xs text-zinc-500">Your imported audio and video files are stored here for easy reuse.</p>
            </div>
            {mediaAssets.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const { clearMediaAssets } = useStore.getState()
                  clearMediaAssets()
                }}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-600 transition hover:border-red-300 hover:text-red-600"
              >
                Clear library
              </button>
            )}
          </div>

          {mediaAssets.length === 0 ? (
            <div className="mt-5 rounded-[2rem] border border-dashed border-zinc-200 bg-zinc-50 py-12 px-5 text-center">
              <ImageIcon size={28} className="mx-auto text-zinc-300" />
              <p className="mt-4 text-sm font-semibold text-zinc-800">No assets yet</p>
              <p className="mt-2 text-xs text-zinc-500">Import a file or paste a link to populate your media library.</p>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
              {mediaAssets.map(asset => (
                <div key={asset.id} className="group min-w-0 overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-zinc-50 shadow-sm transition hover:border-zinc-300">
                  <div className="relative h-24 bg-zinc-950 text-zinc-200 flex items-center justify-center overflow-hidden">
                    {asset.type === 'video' ? (
                      asset.thumbnail ? (
                        <img src={asset.thumbnail} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Film size={24} className="text-zinc-500" />
                      )
                    ) : (
                      <Music size={24} className="text-cyan-400" />
                    )}
                    <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
                      {formatDuration(asset.duration)}
                    </span>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => addToTimeline(asset)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-zinc-900 shadow hover:scale-105 transition-transform"
                        title="Add to timeline"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 line-clamp-2 break-words" title={asset.title}>{asset.title}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[11px] text-zinc-500">
                      <span className={`rounded-full px-2 py-1 font-semibold uppercase ${asset.type === 'video' ? 'bg-violet-100 text-violet-700' : 'bg-cyan-100 text-cyan-700'}`}>
                        {asset.type}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeMediaAsset(asset.id)}
                        className="text-zinc-400 transition hover:text-red-500"
                        title="Delete asset"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div >
    </div >
  )
}

function getAudioDuration(url: string): Promise<number> {
  return new Promise(resolve => {
    const audio = new Audio(url)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      resolve(audio.duration || 30)
      audio.src = ''
    }
    audio.onerror = () => resolve(30)
  })
}
