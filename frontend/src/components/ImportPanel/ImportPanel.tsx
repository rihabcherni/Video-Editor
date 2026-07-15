import React, { useRef, useState } from 'react'
import {
  Upload, Link, Loader2, Download, CheckCircle, Trash2, Plus,
  Film, Music, Globe, Play, Image as ImageIcon, Sparkles, FolderOpen
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

  const handleFileUpload = async (file: File) => {
    const isVideo = file.type.startsWith('video/')
    const isAudio = file.type.startsWith('audio/')

    if (!isVideo && !isAudio) {
      setError('Please select a valid video (MP4, MOV...) or audio (MP3, WAV...) file.')
      return
    }

    setLoading(true)
    setError(null)
    setUploadProgress(0)

    try {
      if (isVideo) {
        const info = await uploadVideo(file, setUploadProgress)
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
      pushActionToast('Asset imported successfully!')
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Upload failed'))
    } finally {
      setLoading(false)
      setUploadProgress(0)
    }
  }

  const handleUrlDownload = async () => {
    if (!urlInput.trim()) return
    setLoading(true)
    setError(null)

    const isAudioLink = urlInput.includes('.mp3') || urlInput.includes('.wav') || urlInput.includes('.ogg')

    try {
      if (isAudioLink) {
        const result = await downloadAudioFromUrl(urlInput.trim())
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
        const info = await downloadFromUrl(urlInput.trim())
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
      setUrlInput('')
      pushActionToast('Asset downloaded successfully!')
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Download failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
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
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Media Library</h2>
        <p className="text-xs text-zinc-500">Upload multiple videos and audios, then add them to your project.</p>
      </div>

      <div className="bg-zinc-50 rounded-2xl border border-zinc-200 p-3 space-y-3">
        <div className="flex gap-2 border-b border-zinc-200 pb-2">
          <button
            type="button"
            onClick={() => setUploadTab('file')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              uploadTab === 'file' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500 hover:bg-zinc-200/50'
            }`}
          >
            Local Files
          </button>
          <button
            type="button"
            onClick={() => setUploadTab('link')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              uploadTab === 'link' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500 hover:bg-zinc-200/50'
            }`}
          >
            Paste URL Link
          </button>
        </div>

        {uploadTab === 'file' ? (
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              dragOver ? 'border-cyan-600 bg-cyan-50' : 'border-zinc-300 hover:border-zinc-400 hover:bg-white'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,audio/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file)
              }}
            />
            {loading ? (
              <div className="space-y-2">
                <Loader2 className="mx-auto text-cyan-600 animate-spin" size={24} />
                <p className="text-xs font-semibold text-zinc-700">Importing asset...</p>
                {uploadProgress > 0 && (
                  <div className="w-full max-w-xs mx-auto bg-zinc-200 h-1 rounded-full overflow-hidden">
                    <div className="bg-cyan-600 h-full transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                )}
              </div>
            ) : (
              <>
                <Upload size={24} className="mx-auto mb-2 text-zinc-400" />
                <p className="text-xs font-semibold text-zinc-700">Click to browse or drop files here</p>
                <p className="text-[10px] text-zinc-400 mt-1">MP4, MOV, MKV, MP3, WAV, AAC</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="url"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="YouTube, TikTok, Facebook or direct media link"
                disabled={loading}
                className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-zinc-900 placeholder:text-zinc-400"
              />
            </div>
            <button
              type="button"
              onClick={handleUrlDownload}
              disabled={loading || !urlInput.trim()}
              className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-400 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <><Loader2 size={13} className="animate-spin" /> Fetching media...</>
              ) : (
                <><Download size={13} /> Fetch Media</>
              )}
            </button>
            <div className="flex gap-2 justify-center text-[9px] text-zinc-400">
              <span>YouTube</span> · <span>Instagram</span> · <span>Facebook</span> · <span>TikTok</span>
            </div>
          </div>
        )}

        {error && <div className="text-[11px] text-red-600 bg-red-50 p-2 rounded-lg">{error}</div>}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
            <FolderOpen size={13} className="text-zinc-500" /> Library Assets ({mediaAssets.length})
          </h3>
          {mediaAssets.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const { clearMediaAssets } = useStore.getState()
                clearMediaAssets()
              }}
              className="text-[10px] text-zinc-400 hover:text-red-500 font-semibold"
            >
              Clear Library
            </button>
          )}
        </div>

        {mediaAssets.length === 0 ? (
          <div className="border border-zinc-200 border-dashed rounded-2xl py-12 text-center bg-white">
            <ImageIcon size={24} className="mx-auto mb-2 text-zinc-300" />
            <p className="text-xs font-medium text-zinc-400">Your media library is empty.</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">Upload files to list assets here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1">
            {mediaAssets.map(asset => (
              <div key={asset.id} className="group relative bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm flex flex-col hover:border-zinc-300 transition-all">
                <div className="relative h-20 bg-zinc-950 flex items-center justify-center overflow-hidden">
                  {asset.type === 'video' ? (
                    asset.thumbnail ? (
                      <img src={asset.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Film size={20} className="text-zinc-600" />
                    )
                  ) : (
                    <Music size={20} className="text-blue-500" />
                  )}
                  <span className="absolute bottom-1 right-1 bg-black/75 px-1 py-0.5 rounded text-[8px] font-mono text-white">
                    {formatDuration(asset.duration)}
                  </span>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                    <button
                      type="button"
                      onClick={() => addToTimeline(asset)}
                      className="p-1.5 bg-white text-zinc-950 rounded-full hover:scale-110 transition-all shadow"
                      title="Add to Timeline"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                <div className="p-2 flex flex-col justify-between flex-1">
                  <div className="text-[10px] font-semibold text-zinc-800 line-clamp-2" title={asset.title}>
                    {asset.title}
                  </div>
                  <div className="flex items-center justify-between mt-1 pt-1 border-t border-zinc-100">
                    <span className={`text-[8px] px-1 py-0.5 rounded font-bold uppercase ${
                      asset.type === 'video' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {asset.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeMediaAsset(asset.id)}
                      className="text-zinc-400 hover:text-red-500"
                      title="Delete asset"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
