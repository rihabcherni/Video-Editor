import React, { useState } from 'react'
import { Trash2, Plus, Film, Music, Image as ImageIcon } from 'lucide-react'
import { useStore } from '../../store/useStore'
import {
  deleteUploadedFile, deleteUploadedFiles, getApiErrorMessage
} from '../../api/client'
import { createId } from '../../utils/id'
import VideoUploadSection from './VideoUploadSection'
import AudioUploadSection from './AudioUploadSection'

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

  const [uploadTab, setUploadTab] = useState<'video' | 'audio'>('video')

  const addToTimeline = (asset: typeof mediaAssets[0], switchTab = false) => {
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
    if (switchTab) setActiveTab('montage')
  }

  const addAllToTimeline = () => {
    let videoCount = 0
    let audioCount = 0
    mediaAssets.forEach(asset => {
      if (asset.type === 'video') {
        addMontageClip({
          id: createId(),
          title: asset.title,
          filename: asset.filename,
          url: asset.url,
          duration: asset.duration,
          thumbnail: asset.thumbnail
        }, asset.duration)
        videoCount++
      } else {
        addMontageAudioClip({
          id: createId(),
          filename: asset.filename,
          url: asset.url
        }, asset.duration)
        audioCount++
      }
    })
    pushActionToast(`Added ${videoCount} video${videoCount > 1 ? 's' : ''} and ${audioCount} audio${audioCount > 1 ? 's' : ''} to timeline`)
  }

  const handleDeleteAsset = async (asset: typeof mediaAssets[0]) => {
    try {
      await deleteUploadedFile(asset.filename)
      removeMediaAsset(asset.id)
      pushActionToast(`Deleted "${asset.title}" from the library and uploads folder`)
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Failed to delete asset')
      pushActionToast(message)
    }
  }

  const handleClearLibrary = async () => {
    if (mediaAssets.length === 0) return

    const filenames = mediaAssets.map(asset => asset.filename)
    try {
      await deleteUploadedFiles(filenames)
      const { clearMediaAssets } = useStore.getState()
      clearMediaAssets()
      pushActionToast(`Deleted ${filenames.length} asset${filenames.length > 1 ? 's' : ''} from the library and uploads folder`)
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Failed to clear library')
      pushActionToast(message)
    }
  }

  return (
    <div className="space-y-3 min-w-0 w-full overflow-hidden">
      <div className="grid gap-4">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-base font-semibold text-slate-900">Import Media</p>
              <p className="mt-1 text-sm text-slate-500">
                Upload files or paste URLs from any platform to import content.
              </p>
            </div>
            <div className="inline-flex rounded-full bg-slate-100 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setUploadTab('video')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${uploadTab === 'video' ? 'bg-cyan-600 text-white shadow' : 'bg-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-50'} ${uploadTab === 'video' ? '' : 'border border-slate-200'}`}
              >
                Video
              </button>
              <button
                type="button"
                onClick={() => setUploadTab('audio')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${uploadTab === 'audio' ? 'bg-blue-600 text-white shadow' : 'bg-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-50'} ${uploadTab === 'audio' ? '' : 'border border-slate-200'}`}
              >
                Audio
              </button>
            </div>
          </div>

          <div className="mt-5">
            {uploadTab === 'video' ? <VideoUploadSection /> : <AudioUploadSection />}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Library Assets ({mediaAssets.length})</p>
              <p className="mt-1 text-xs text-zinc-500">Your imported audio and video files are stored here for easy reuse.</p>
            </div>
            {mediaAssets.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addAllToTimeline}
                  className="rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100"
                >
                  Add all to timeline
                </button>
                <button
                  type="button"
                  onClick={handleClearLibrary}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-600 transition hover:border-red-300 hover:text-red-600"
                >
                  Clear library
                </button>
              </div>
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
                        onClick={() => void handleDeleteAsset(asset)}
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
