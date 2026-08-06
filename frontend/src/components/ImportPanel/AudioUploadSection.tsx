import React, { useState } from 'react'
import { Upload, Music, Loader2 } from 'lucide-react'
import { uploadAudio, downloadAudioFromUrl, getApiErrorMessage } from '../../api/client'
import { useStore } from '../../store/useStore'
import { withMediaBase } from '../../utils/media'
import { createId } from '../../utils/id'

export default function AudioUploadSection() {
  const {
    addMediaAsset,
    pushActionToast,
    audioLoading,
    setAudioLoading,
    audioUploadProgress,
    setAudioUploadProgress,
    audioStatusMessage,
    setAudioStatusMessage,
    audioError,
    setAudioError,
    audioUrlInput,
    setAudioUrlInput,
  } = useStore()

  const [tab, setTab] = useState<'file' | 'url'>('file')

  const handleAudioFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    if (files.length === 0) return

    setAudioLoading(true)
    setAudioError(null)
    setAudioUploadProgress(0)
    setAudioStatusMessage('Preparing audio upload...')

    const importedCount: string[] = []
    const failedFiles: string[] = []

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      const progressOffset = (index / files.length) * 100
      const progressScale = 100 / files.length

      setAudioStatusMessage(`Uploading ${file.name} (${index + 1}/${files.length})...`)

      try {
        const result = await uploadAudio(file)
        const duration = await getAudioDuration(withMediaBase(result.url))
        addMediaAsset({
          id: createId(),
          type: 'audio',
          title: file.name.replace(/\.[^/.]+$/, ''),
          filename: result.filename,
          url: result.url,
          duration,
        })

        const currentPct = Math.round(progressOffset + progressScale)
        setAudioUploadProgress(currentPct)
        setAudioStatusMessage(`Uploaded ${file.name} (${currentPct}%)`)
        importedCount.push(file.name)
      } catch (err: unknown) {
        failedFiles.push(`${file.name}: ${getApiErrorMessage(err, 'Upload failed')}`)
      }
    }

    setAudioUploadProgress(100)
    setAudioStatusMessage('Audio upload complete!')

    setTimeout(() => {
      setAudioLoading(false)
      setAudioUploadProgress(0)
      setAudioStatusMessage(null)
    }, 600)

    if (importedCount.length > 0) {
      pushActionToast(`${importedCount.length} audio${importedCount.length > 1 ? 's' : ''} imported successfully!`)
    }

    if (failedFiles.length > 0) {
      setAudioError(failedFiles.join(' '))
    }
  }

  const handleAudioUrl = async () => {
    const urls = audioUrlInput
      .split(/\s+/)
      .map(url => url.trim())
      .filter(Boolean)

    if (urls.length === 0) return

    setAudioLoading(true)
    setAudioError(null)
    setAudioUploadProgress(5)
    setAudioStatusMessage('Connecting to audio URL...')

    const importedCount: string[] = []
    const failedUrls: string[] = []

    // Smooth progress timer simulation for audio URL downloads
    let currentProgress = 5
    const progressInterval = setInterval(() => {
      currentProgress = Math.min(92, currentProgress + Math.floor(Math.random() * 6) + 3)
      setAudioUploadProgress(currentProgress)
      setAudioStatusMessage(`Downloading audio from URL... (${currentProgress}%)`)
    }, 350)

    try {
      for (let index = 0; index < urls.length; index += 1) {
        const url = urls[index]
        setAudioStatusMessage(`Downloading audio ${index + 1} of ${urls.length}...`)
        try {
          const result = await downloadAudioFromUrl(url)
          const duration = await getAudioDuration(withMediaBase(result.url))
          addMediaAsset({
            id: createId(),
            type: 'audio',
            title: result.filename.replace(/\.[^/.]+$/, ''),
            filename: result.filename,
            url: result.url,
            duration,
          })
          importedCount.push(url)
        } catch (err: unknown) {
          failedUrls.push(`${url}: ${getApiErrorMessage(err, 'Download failed')}`)
        }
      }
    } finally {
      clearInterval(progressInterval)
    }

    setAudioUploadProgress(100)
    setAudioStatusMessage('Audio download complete!')

    setTimeout(() => {
      setAudioLoading(false)
      setAudioUploadProgress(0)
      setAudioStatusMessage(null)
    }, 600)

    if (importedCount.length > 0) {
      pushActionToast(`${importedCount.length} audio${importedCount.length > 1 ? 's' : ''} downloaded successfully!`)
      setAudioUrlInput('')
    }

    if (failedUrls.length > 0) {
      setAudioError(failedUrls.join(' '))
    }
  }

  return (
    <div className="space-y-2">
      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-zinc-200">
        <button
          type="button"
          onClick={() => setTab('file')}
          className={`py-2 px-1 text-xs font-medium transition-all flex items-center justify-center gap-1.5 border-b-2 ${
            tab === 'file' ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-600'
          }`}
        >
          <Upload size={13} /> File
        </button>
        <button
          type="button"
          onClick={() => setTab('url')}
          className={`py-2 px-1 text-xs font-medium transition-all flex items-center justify-center gap-1.5 border-b-2 ${
            tab === 'url' ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-600'
          }`}
        >
          <Music size={13} /> URL
        </button>
      </div>

      {/* Persistent Progress Bar when loading */}
      {audioLoading && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
            <span className="flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin text-blue-600" />
              {audioStatusMessage || 'Processing audio...'}
            </span>
            <span className="text-blue-700 font-mono">{audioUploadProgress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-blue-200/60">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300 rounded-full"
              style={{ width: `${Math.max(3, audioUploadProgress)}%` }}
            />
          </div>
        </div>
      )}

      {tab === 'file' ? (
        <div className="space-y-3">
          <div className="relative">
            <input
              type="file"
              accept="audio/*"
              onChange={handleAudioFiles}
              disabled={audioLoading}
              multiple
              className="hidden"
              id="audio-file-input"
            />
            <label
              htmlFor="audio-file-input"
              className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-all ${
                audioLoading
                  ? 'border-zinc-200 bg-zinc-50 cursor-not-allowed'
                  : 'border-zinc-300 bg-zinc-50 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
              }`}
            >
              {audioLoading ? (
                <>
                  <Loader2 size={24} className="text-blue-600 animate-spin mb-2" />
                  <p className="text-sm font-medium text-zinc-700">Uploading Audio... {audioUploadProgress}%</p>
                  <p className="text-xs text-zinc-500 mt-1">Please wait while your audio is being processed.</p>
                </>
              ) : (
                <>
                  <Upload size={24} className="text-zinc-400 mb-2" />
                  <p className="text-sm font-medium text-zinc-700">Click to upload audio files</p>
                  <p className="text-xs text-zinc-500 mt-1">MP3, WAV, M4A, etc. (Multiple files supported)</p>
                </>
              )}
            </label>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <textarea
              value={audioUrlInput}
              onChange={e => setAudioUrlInput(e.target.value)}
              placeholder="Paste audio URLs from SoundCloud, Spotify, etc. (One per line or separated by spaces)"
              disabled={audioLoading}
              rows={3}
              className={`w-full resize-none rounded-xl border px-4 py-3 text-sm ${
                audioLoading
                  ? 'border-zinc-200 bg-zinc-50 opacity-65'
                  : 'border-zinc-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
              }`}
            />
          </div>

          <button
            type="button"
            onClick={handleAudioUrl}
            disabled={audioLoading || !audioUrlInput.trim()}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >
            {audioLoading ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Downloading... {audioUploadProgress}%
              </>
            ) : (
              <>
                <Music size={13} /> Download Audio
              </>
            )}
          </button>
        </div>
      )}

      {audioError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center justify-between">
          <span>{audioError}</span>
          <button type="button" onClick={() => setAudioError(null)} className="text-red-500 hover:text-red-800 text-xs font-bold ml-2">×</button>
        </div>
      )}
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

