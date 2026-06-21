import React, { useRef, useState } from 'react'
import { Music, Upload, Link, Loader2, CheckCircle, X, Download } from 'lucide-react'
import { uploadAudio, downloadAudioFromUrl, getApiErrorMessage } from '../../api/client'
import { useStore } from '../../store/useStore'
import { SocialIcon } from 'react-social-icons'
import { PLATFORM_ICONS, detectPlatform } from './uploadConstants.tsx'
import { withMediaBase } from '../../utils/media'

export default function AudioUploadSection() {
    const {
        audioTrack,
        setAudioTrack,
        setAudioApplied,
        audioUrlInput,
        setAudioUrlInput,
        audioLoading,
        setAudioLoading,
        audioError,
        setAudioError,
        setAudioDuration,
        setAudioTrimStart,
        setAudioTrimEnd,
        pushActionToast,
    } = useStore()

    const [tab, setTab] = useState<'file' | 'url'>('file')
    const [dragOver, setDragOver] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    const platform = detectPlatform(audioUrlInput)

    const hydrateAudioMetadata = (url: string) => {
        const audio = new Audio()
        audio.preload = 'metadata'
        audio.src = withMediaBase(url)
        audio.onloadedmetadata = () => {
            const d = audio.duration || 0
            if (Number.isFinite(d) && d > 0) {
                setAudioDuration(d)
                setAudioTrimStart(0)
                setAudioTrimEnd(d)
            }
        }
    }

    const handleAudioUpload = async (file: File) => {
        if (!file.type.startsWith('audio/')) {
            setAudioError('Please select an audio file (MP3, WAV, AAC...)')
            return
        }
        setAudioLoading(true)
        setAudioError(null)
        try {
            const result = await uploadAudio(file)
            setAudioTrack(result)
            setAudioApplied(false)
            hydrateAudioMetadata(result.url)
            pushActionToast('Audio imported successfully.')
        } catch (e: unknown) {
            setAudioError(getApiErrorMessage(e, 'Upload failed'))
        } finally {
            setAudioLoading(false)
        }
    }

    const handleAudioUrl = async () => {
        if (!audioUrlInput.trim()) return
        setAudioLoading(true)
        setAudioError(null)
        try {
            const result = await downloadAudioFromUrl(audioUrlInput.trim())
            setAudioTrack(result)
            setAudioApplied(false)
            hydrateAudioMetadata(result.url)
            setAudioUrlInput('')
            pushActionToast('Audio imported successfully.')
        } catch (e: unknown) {
            setAudioError(getApiErrorMessage(e, 'Download failed'))
        } finally {
            setAudioLoading(false)
        }
    }

    const handleAudioDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) handleAudioUpload(file)
    }

    return (
        <div className="space-y-3">
            {/* Audio loaded state */}
            {audioTrack ? (
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 border border-blue-200">
                    <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                            <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                                <CheckCircle size={24} className="text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-blue-900">{audioTrack.filename}</p>
                                <p className="text-xs text-blue-700 mt-0.5">Audio track loaded</p>
                            </div>
                        </div>
                        <button type="button"
                            onClick={() => setAudioTrack(null)}
                            className="p-1 hover:bg-blue-200 rounded-lg transition-colors text-blue-600"
                            aria-label="Remove audio track"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Tab switcher */}
                    <div className="flex gap-2 border-b border-zinc-200">
                        <button type="button"
                            onClick={() => setTab('file')}
                            className={`py-2 px-1 text-xs font-medium transition-all flex items-center justify-center gap-1.5 border-b-2 ${tab === 'file' ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-600'
                                }`}
                        >
                            <Upload size={13} /> File
                        </button>
                        <button type="button"
                            onClick={() => setTab('url')}
                            className={`py-2 px-1 text-xs font-medium transition-all flex items-center justify-center gap-1.5 border-b-2 ${tab === 'url' ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-600'
                                }`}
                        >
                            <Link size={13} /> URL
                        </button>
                    </div>

                    {tab === 'file' ? (
                        <div
                            onDrop={handleAudioDrop}
                            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                            onDragLeave={() => setDragOver(false)}
                            onClick={() => fileRef.current?.click()}
                            className={`border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center cursor-pointer transition-all ${dragOver ? 'border-cyan-600 bg-cyan-600/10' : 'border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50'}`}>
                            <input
                                ref={fileRef}
                                type="file"
                                accept="audio/*"
                                className="hidden"
                                aria-label="Upload audio file"
                                onChange={e => {
                                    const file = e.target.files?.[0]
                                    e.currentTarget.value = ''
                                    if (file) handleAudioUpload(file)
                                }}
                            />
                            <Music size={32} className="mx-auto mb-3 text-zinc-400" />
                            <p className="text-zinc-700 font-medium text-sm">Upload audio track</p>
                            <p className="text-zinc-500 text-xs mt-1">MP3, WAV, AAC, FLAC</p>
                            {audioLoading && <p className="text-cyan-600 text-xs mt-2 animate-pulse">Uploading...</p>}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs text-zinc-500">Download high-quality audio (MP3) from supported platforms (YouTube, Instagram, TikTok or Facebook)</p>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                    {platform ? PLATFORM_ICONS[platform] : <Link size={16} className="text-zinc-400" />}
                                </div>
                                <input
                                    type="url"
                                    value={audioUrlInput}
                                    onChange={e => setAudioUrlInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAudioUrl()}
                                    placeholder="https://youtube.com/watch?v=... or Instagram / Facebook / Tiktok"
                                    className="w-full bg-white border border-zinc-300 rounded-xl pl-10 pr-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 transition-all text-sm"
                                />
                            </div>
                            <button type="button"
                                onClick={handleAudioUrl}
                                disabled={audioLoading || !audioUrlInput.trim()}
                                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 w-full text-sm"
                            >
                                {audioLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                {audioLoading ? 'Downloading...' : 'Download'}
                            </button>
                            <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                                <span className="flex items-center gap-1"><SocialIcon network="youtube" style={{ height: 18, width: 18 }} /> YouTube</span>
                                <span className="flex items-center gap-1"><SocialIcon network="instagram" style={{ height: 18, width: 18 }} /> Instagram</span>
                                <span className="flex items-center gap-1"><SocialIcon network="facebook" style={{ height: 18, width: 18 }} /> Facebook</span>
                                <span className="flex items-center gap-1"><SocialIcon network="tiktok" style={{ height: 18, width: 18 }} /> TikTok</span>
                            </div>
                        </div>
                    )}

                    {audioError && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
                            {audioError}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
