import React, { useState } from 'react'
import VideoUploadSection from './VideoUploadSection'
import AudioUploadSection from './AudioUploadSection'

export default function ImportPanel() {
  const [importTab, setImportTab] = useState<'video' | 'audio'>('video')

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">Import media</h2>
        <p className="text-xs text-zinc-500">Paste a link or upload a local video or audio files</p>
      </div>

      {/* Tabs */}
      <div className="bg-zinc-100 rounded-2xl p-1 border border-zinc-200">
        <div className="grid grid-cols-2 gap-1">
          {[
            { id: 'video', label: 'Video' },
            { id: 'audio', label: 'Audio' },
          ].map(tab => (
            <button type="button"
              key={tab.id}
              onClick={() => setImportTab(tab.id as typeof importTab)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${importTab === tab.id
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Video Tab */}
      {importTab === 'video' && (
        <VideoUploadSection />
      )}

      {/* Audio Tab */}
      {importTab === 'audio' && (
        <AudioUploadSection />
      )}
    </div>
  )
}
