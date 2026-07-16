import React, { useRef, useState } from 'react'
import {
  Upload, Loader2, Download, Trash2, Plus,
  Film, Music, Globe, Image as ImageIcon, Sparkles, FolderOpen
} from 'lucide-react'
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

    setLoading(true)
    setError(null)

    const importedCount: string[] = []
    const invalidUrls: string[] = []
    const failedUrls: string[] = []

    for (let index = 0; index < urls.length; index += 1) {
      const url = urls[index]
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

    if (failedUrls.length > 0) {
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
    <div className="space-y-4 min-w-0 w-full overflow-hidden">
      <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-zinc-900">Media Library</p>
            <p className="mt-2 text-sm text-zinc-500">
              Import videos and audio from YouTube, Instagram, Facebook, TikTok, or your local files. Then add assets to your timeline with a single click.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {['YouTube', 'Instagram', 'Facebook', 'TikTok', 'Local file'].map(source => (
              <span key={source} className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-600">
                {source}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900">Import assets</p>
              <p className="mt-1 text-xs text-zinc-500">
                Drop a file, browse local media, or paste a supported link to import video or audio.
              </p>
            </div>
            <div className="inline-flex rounded-2xl bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setUploadTab('file')}
                className={`rounded-2xl px-4 py-2 text-xs font-semibold transition ${uploadTab === 'file' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-transparent text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50'} border border-transparent ${uploadTab === 'file' ? '' : 'border-zinc-200'}`}
              >
                Local files
              </button>
              <button
                type="button"
                onClick={() => setUploadTab('link')}
                className={`rounded-2xl px-4 py-2 text-xs font-semibold transition ${uploadTab === 'link' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-transparent text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50'} border border-transparent ${uploadTab === 'link' ? '' : 'border-zinc-200'}`}
              >
                Paste URL
              </button>
            </div>
          </div>

          <div className="mt-4">
            {uploadTab === 'file' ? (
              <div
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-6 min-h-[160px] text-center cursor-pointer transition-all ${dragOver ? 'border-cyan-600 bg-cyan-50' : 'border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-100'
                  }`}
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
                    <Loader2 className="mx-auto text-cyan-600 animate-spin" size={28} />
                    <p className="text-sm font-semibold text-zinc-700">Importing asset...</p>
                    {uploadProgress > 0 && (
                      <div className="mx-auto w-full max-w-full bg-zinc-200 h-2 rounded-full overflow-hidden">
                        <div className="bg-cyan-600 h-full transition-all" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <Upload size={28} className="mx-auto mb-3 text-zinc-400" />
                    <p className="text-sm font-semibold text-zinc-900">Click to browse or drop files here</p>
                    <p className="mt-2 text-xs text-zinc-500">
                      Supported formats: MP4, MOV, MKV, MP3, WAV, AAC.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-3xl border border-zinc-200 bg-white p-3 shadow-sm">
                  <div className="relative">
                    <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <textarea
                      value={urlInput}
                      onChange={e => setUrlInput(e.target.value)}
                      placeholder="Paste one or more public YouTube, Instagram, Facebook or TikTok links, separated by spaces or new lines"
                      disabled={loading}
                      rows={4}
                      className="w-full resize-none rounded-2xl border border-zinc-200 bg-white py-3 pl-12 pr-4 text-sm text-zinc-700 focus:outline-none focus:border-zinc-900 placeholder:text-zinc-400"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={handleUrlDownload}
                    disabled={loading || !urlInput.trim()}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:bg-zinc-200 disabled:text-zinc-400"
                  >
                    {loading ? <><Loader2 size={14} className="animate-spin" /> Fetching media...</> : <><Download size={14} /> Fetch media</>}
                  </button>
                  <div className="rounded-2xl bg-white border border-zinc-200 px-4 py-3 text-xs text-zinc-500 shadow-sm">
                    Supported: YouTube · Instagram · Facebook · TikTok
                  </div>
                </div>
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
      </div>
    </div>
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
