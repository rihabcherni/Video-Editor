import { useState } from 'react'
import { Upload, Film, Loader2 } from 'lucide-react'
import { downloadFromUrl, uploadVideo, getApiErrorMessage } from '../../api/client'
import { useStore } from '../../store/useStore'
import { createId } from '../../utils/id'

export default function VideoUploadSection() {
  const { addMediaAsset, pushActionToast } = useStore()
  const [videoTab, setVideoTab] = useState<'file' | 'url'>('file')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')

  const handleVideoFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    if (files.length === 0) return

    setLoading(true)
    setError(null)
    setUploadProgress(0)

    const importedCount: string[] = []
    const failedFiles: string[] = []

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      const progressOffset = (index / files.length) * 100
      const progressScale = 100 / files.length

      try {
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
        importedCount.push(file.name)
      } catch (err: unknown) {
        failedFiles.push(`${file.name}: ${getApiErrorMessage(err, 'Upload failed')}`)
      }
    }

    setUploadProgress(100)
    setLoading(false)

    if (importedCount.length > 0) {
      pushActionToast(`${importedCount.length} video${importedCount.length > 1 ? 's' : ''} imported successfully!`)
    }

    if (failedFiles.length > 0) {
      setError(failedFiles.join(' '))
    }
  }

  const handleVideoUrl = async () => {
    const urls = urlInput
      .split(/\s+/)
      .map(url => url.trim())
      .filter(Boolean)

    if (urls.length === 0) return

    setLoading(true)
    setError(null)

    const importedCount: string[] = []
    const failedUrls: string[] = []

    for (let index = 0; index < urls.length; index += 1) {
      const url = urls[index]
      try {
        const result = await downloadFromUrl(url)
        addMediaAsset({
          id: createId(),
          type: 'video',
          title: result.title,
          filename: result.filename,
          url: result.url,
          duration: result.duration,
          thumbnail: result.thumbnail
        })
        importedCount.push(url)
      } catch (err: unknown) {
        failedUrls.push(`${url}: ${getApiErrorMessage(err, 'Download failed')}`)
      }
    }

    setLoading(false)

    if (importedCount.length > 0) {
      pushActionToast(`${importedCount.length} video${importedCount.length > 1 ? 's' : ''} downloaded successfully!`)
      setUrlInput('')
    }

    if (failedUrls.length > 0) {
      setError(failedUrls.join(' '))
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 mb-1">Video Source</h3>
        <p className="text-xs text-zinc-500">Upload from file or paste a URL from any platform</p>
      </div>

      {/* Tab switcher for File/URL */}
      <div className="flex gap-2 border-b border-zinc-200">
        <button 
          type="button"
          onClick={() => setVideoTab('file')}
          className={`py-2 px-1 text-xs font-medium transition-all flex items-center justify-center gap-1.5 border-b-2 ${videoTab === 'file' ? 'border-cyan-600 text-cyan-600' : 'border-transparent text-zinc-500 hover:text-zinc-600'
            }`}
        >
          <Upload size={13} /> File
        </button>
        <button 
          type="button"
          onClick={() => setVideoTab('url')}
          className={`py-2 px-1 text-xs font-medium transition-all flex items-center justify-center gap-1.5 border-b-2 ${videoTab === 'url' ? 'border-cyan-600 text-cyan-600' : 'border-transparent text-zinc-500 hover:text-zinc-600'
            }`}
        >
          <Film size={13} /> URL
        </button>
      </div>

      {videoTab === 'file' ? (
        <div className="space-y-3">
          <div className="relative">
            <input
              type="file"
              accept="video/*"
              onChange={handleVideoFiles}
              disabled={loading}
              multiple
              className="hidden"
              id="video-file-input"
            />
            <label
              htmlFor="video-file-input"
              className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-all ${
                loading 
                  ? 'border-zinc-200 bg-zinc-50 cursor-not-allowed' 
                  : 'border-zinc-300 bg-zinc-50 hover:border-cyan-400 hover:bg-cyan-50 cursor-pointer'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 size={24} className="text-cyan-600 animate-spin mb-2" />
                  <p className="text-sm font-medium text-zinc-700">Uploading... {uploadProgress}%</p>
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
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste video URLs from YouTube, Instagram, TikTok, etc. (One per line or separated by spaces)"
              disabled={loading}
              rows={3}
              className={`w-full resize-none rounded-xl border px-4 py-3 pr-12 text-sm ${
                loading ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-300 bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20'
              }`}
            />
          </div>

          <button
            type="button"
            onClick={handleVideoUrl}
            disabled={loading || !urlInput.trim()}
            className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Downloading...
              </>
            ) : (
              <>
                <Film size={13} /> Download Video
              </>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
    </div>
  )
}
