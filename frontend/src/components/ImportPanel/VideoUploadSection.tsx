import React, { useState } from 'react'
import { Upload, Film, Loader2 } from 'lucide-react'
import { downloadFromUrl, uploadVideo, getApiErrorMessage } from '../../api/client'
import { useStore } from '../../store/useStore'
import { createId } from '../../utils/id'

export default function VideoUploadSection() {
  const {
    addMediaAsset,
    pushActionToast,
    videoLoading,
    setVideoLoading,
    videoUploadProgress,
    setVideoUploadProgress,
    videoStatusMessage,
    setVideoStatusMessage,
    videoError,
    setVideoError,
    videoUrlInput,
    setVideoUrlInput,
  } = useStore()

  const [videoTab, setVideoTab] = useState<'file' | 'url'>('file')

  const handleVideoFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    if (files.length === 0) return

    setVideoLoading(true)
    setVideoError(null)
    setVideoUploadProgress(0)
    setVideoStatusMessage('Preparing upload...')

    const importedCount: string[] = []
    const failedFiles: string[] = []

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      const progressOffset = (index / files.length) * 100
      const progressScale = 100 / files.length

      setVideoStatusMessage(`Uploading ${file.name} (${index + 1}/${files.length})...`)

      try {
        const info = await uploadVideo(file, value => {
          const currentPct = Math.round(progressOffset + (value * progressScale) / 100)
          setVideoUploadProgress(currentPct)
          setVideoStatusMessage(`Uploading ${file.name} (${currentPct}%)`)
        })
        addMediaAsset({
          id: createId(),
          type: 'video',
          title: file.name.replace(/\.[^/.]+$/, ''),
          filename: info.filename,
          url: info.url,
          duration: info.duration,
          thumbnail: info.thumbnail,
        })
        importedCount.push(file.name)
      } catch (err: unknown) {
        failedFiles.push(`${file.name}: ${getApiErrorMessage(err, 'Upload failed')}`)
      }
    }

    setVideoUploadProgress(100)
    setVideoStatusMessage('Upload complete!')

    setTimeout(() => {
      setVideoLoading(false)
      setVideoUploadProgress(0)
      setVideoStatusMessage(null)
    }, 600)

    if (importedCount.length > 0) {
      pushActionToast(`${importedCount.length} video${importedCount.length > 1 ? 's' : ''} imported successfully!`)
    }

    if (failedFiles.length > 0) {
      setVideoError(failedFiles.join(' '))
    }
  }

  const handleVideoUrl = async () => {
    const urls = videoUrlInput
      .split(/\s+/)
      .map(url => url.trim())
      .filter(Boolean)

    if (urls.length === 0) return

    setVideoLoading(true)
    setVideoError(null)
    setVideoUploadProgress(5)
    setVideoStatusMessage('Connecting to media URL...')

    const importedCount: string[] = []
    const failedUrls: string[] = []

    // Smooth progress timer simulation for URL downloads
    let currentProgress = 5
    const progressInterval = setInterval(() => {
      currentProgress = Math.min(92, currentProgress + Math.floor(Math.random() * 6) + 2)
      setVideoUploadProgress(currentProgress)
      setVideoStatusMessage(`Downloading from URL... (${currentProgress}%)`)
    }, 400)

    try {
      for (let index = 0; index < urls.length; index += 1) {
        const url = urls[index]
        setVideoStatusMessage(`Downloading video ${index + 1} of ${urls.length}...`)
        try {
          const result = await downloadFromUrl(url)
          addMediaAsset({
            id: createId(),
            type: 'video',
            title: result.title,
            filename: result.filename,
            url: result.url,
            duration: result.duration,
            thumbnail: result.thumbnail,
          })
          importedCount.push(url)
        } catch (err: unknown) {
          failedUrls.push(`${url}: ${getApiErrorMessage(err, 'Download failed')}`)
        }
      }
    } finally {
      clearInterval(progressInterval)
    }

    setVideoUploadProgress(100)
    setVideoStatusMessage('Download complete!')

    setTimeout(() => {
      setVideoLoading(false)
      setVideoUploadProgress(0)
      setVideoStatusMessage(null)
    }, 600)

    if (importedCount.length > 0) {
      pushActionToast(`${importedCount.length} video${importedCount.length > 1 ? 's' : ''} downloaded successfully!`)
      setVideoUrlInput('')
    }

    if (failedUrls.length > 0) {
      setVideoError(failedUrls.join(' '))
    }
  }

  return (
    <div className="space-y-2">
      {/* Tab switcher for File/URL */}
      <div className="flex gap-2 border-b border-zinc-200">
        <button
          type="button"
          onClick={() => setVideoTab('file')}
          className={`py-2 px-1 text-xs font-medium transition-all flex items-center justify-center gap-1.5 border-b-2 ${
            videoTab === 'file' ? 'border-cyan-600 text-cyan-600' : 'border-transparent text-zinc-500 hover:text-zinc-600'
          }`}
        >
          <Upload size={13} /> File
        </button>
        <button
          type="button"
          onClick={() => setVideoTab('url')}
          className={`py-2 px-1 text-xs font-medium transition-all flex items-center justify-center gap-1.5 border-b-2 ${
            videoTab === 'url' ? 'border-cyan-600 text-cyan-600' : 'border-transparent text-zinc-500 hover:text-zinc-600'
          }`}
        >
          <Film size={13} /> URL
        </button>
      </div>

      {/* Persistent Progress Bar when loading */}
      {videoLoading && (
        <div className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-3 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-cyan-900">
            <span className="flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin text-cyan-600" />
              {videoStatusMessage || 'Processing...'}
            </span>
            <span className="text-cyan-700 font-mono">{videoUploadProgress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-cyan-200/60">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-300 rounded-full"
              style={{ width: `${Math.max(3, videoUploadProgress)}%` }}
            />
          </div>
        </div>
      )}

      {videoTab === 'file' ? (
        <div className="space-y-3">
          <div className="relative">
            <input
              type="file"
              accept="video/*"
              onChange={handleVideoFiles}
              disabled={videoLoading}
              multiple
              className="hidden"
              id="video-file-input"
            />
            <label
              htmlFor="video-file-input"
              className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-all ${
                videoLoading
                  ? 'border-zinc-200 bg-zinc-50 cursor-not-allowed'
                  : 'border-zinc-300 bg-zinc-50 hover:border-cyan-400 hover:bg-cyan-50 cursor-pointer'
              }`}
            >
              {videoLoading ? (
                <>
                  <Loader2 size={24} className="text-cyan-600 animate-spin mb-2" />
                  <p className="text-sm font-medium text-zinc-700">Uploading Video... {videoUploadProgress}%</p>
                  <p className="text-xs text-zinc-500 mt-1">Please wait while your video is being processed.</p>
                </>
              ) : (
                <>
                  <Upload size={24} className="text-zinc-400 mb-2" />
                  <p className="text-sm font-medium text-zinc-700">Click to upload video files</p>
                  <p className="text-xs text-zinc-500 mt-1">MP4, WebM, MOV, etc. (Multiple files supported)</p>
                </>
              )}
            </label>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <textarea
              value={videoUrlInput}
              onChange={e => setVideoUrlInput(e.target.value)}
              placeholder="Paste video URLs from YouTube, Instagram, TikTok, etc. (One per line or separated by spaces)"
              disabled={videoLoading}
              rows={3}
              className={`w-full resize-none rounded-xl border px-4 py-3 text-sm ${
                videoLoading
                  ? 'border-zinc-200 bg-zinc-50 opacity-65'
                  : 'border-zinc-300 bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20'
              }`}
            />
          </div>

          <button
            type="button"
            onClick={handleVideoUrl}
            disabled={videoLoading || !videoUrlInput.trim()}
            className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >
            {videoLoading ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Downloading... {videoUploadProgress}%
              </>
            ) : (
              <>
                <Film size={13} /> Download Video
              </>
            )}
          </button>
        </div>
      )}

      {videoError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center justify-between">
          <span>{videoError}</span>
          <button type="button" onClick={() => setVideoError(null)} className="text-red-500 hover:text-red-800 text-xs font-bold ml-2">×</button>
        </div>
      )}
    </div>
  )
}

