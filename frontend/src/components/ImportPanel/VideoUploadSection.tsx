import React, { useRef, useState } from 'react'
import { Upload, Link, Loader2, Download, CheckCircle, X, Layers, Scissors } from 'lucide-react'
import { downloadFromUrl, uploadVideo, getApiErrorMessage } from '../../api/client'
import { useStore } from '../../store/useStore'
import { SocialIcon } from 'react-social-icons'
import { PLATFORM_ICONS, detectPlatform, isLikelyPublicFacebookVideo } from './uploadConstants.tsx'

export default function VideoUploadSection() {
    const { video, setVideo, videoUrlInput, setVideoUrlInput, videoLoading, setVideoLoading, videoError, setVideoError, pushActionToast } = useStore()
    const [videoTab, setVideoTab] = useState<'file' | 'url'>('file')
    const [uploadProgress, setUploadProgress] = useState(0)
    const [dragOver, setDragOver] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    const platform = detectPlatform(videoUrlInput)
    const handleUrlDownload = async () => {
        if (!videoUrlInput.trim()) return
        setVideoLoading(true)
        setVideoError(null)
        if (platform === 'facebook' && !isLikelyPublicFacebookVideo(videoUrlInput)) {
            setVideoLoading(false)
            setVideoError('Please paste a direct public Facebook video/reel link (with an ID).')
            return
        }
        try {
            const info = await downloadFromUrl(videoUrlInput)
            setVideo(info)
            setVideoUrlInput('')
            pushActionToast('Video imported successfully.')
        } catch (e: unknown) {
            setVideoError(getApiErrorMessage(e, 'Download failed'))
        } finally {
            setVideoLoading(false)
        }
    }

    const handleFileUpload = async (file: File) => {
        if (!file.type.startsWith('video/')) {
            setVideoError('Please select a video file')
            return
        }
        setVideoLoading(true)
        setVideoError(null)
        setUploadProgress(0)
        try {
            const info = await uploadVideo(file, setUploadProgress)
            setVideo(info)
            pushActionToast('Video imported successfully.')
        } catch (e: unknown) {
            setVideoError(getApiErrorMessage(e, 'Upload failed'))
        } finally {
            setVideoLoading(false)
            setUploadProgress(0)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFileUpload(file)
    }

    return (
        <div className="space-y-3">
            {/* Video loaded state */}
            {video ? (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-200 space-y-3">
                    <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                            <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                                <CheckCircle size={24} className="text-green-600" />
                            </div>
                            <div>
                                {video.thumbnail && (
                                    <img
                                        src={video.thumbnail}
                                        alt=""
                                        className="w-16 h-16 rounded-lg object-cover mb-2 border border-green-200"
                                        onError={event => {
                                            event.currentTarget.style.display = 'none'
                                        }}
                                    />
                                )}
                                <p className="text-sm font-semibold text-green-900">{video.title}</p>
                                <p className="text-xs text-green-700 mt-0.5">{video.filename}</p>
                            </div>
                        </div>
                        <button type="button"
                            onClick={() => setVideo(null)}
                            className="p-1 hover:bg-green-200 rounded-lg transition-colors text-green-600"
                            aria-label="Remove video"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="pt-2 border-t border-green-200/50 flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                const { addMontageClip, setActiveTab } = useStore.getState()
                                addMontageClip(video, video.duration)
                                setVideo(null)
                                setActiveTab('montage')
                                pushActionToast('Added to montage timeline. Upload next video!')
                            }}
                            className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                        >
                            <Layers size={13} /> Add to Montage Timeline
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                const { setActiveTab } = useStore.getState()
                                setActiveTab('edit')
                            }}
                            className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                        >
                            <Scissors size={13} /> Edit Single Video
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Tab switcher for File/URL */}
                    <div className="flex gap-2 border-b border-zinc-200">
                        <button type="button"
                            onClick={() => setVideoTab('file')}
                            className={`py-2 px-1 text-xs font-medium transition-all flex items-center justify-center gap-1.5 border-b-2 ${videoTab === 'file' ? 'border-cyan-600 text-cyan-600' : 'border-transparent text-zinc-500 hover:text-zinc-600'
                                }`}
                        >
                            <Upload size={13} /> File
                        </button>
                        <button type="button"
                            onClick={() => setVideoTab('url')}
                            className={`py-2 px-1 text-xs font-medium transition-all flex items-center justify-center gap-1.5 border-b-2 ${videoTab === 'url' ? 'border-cyan-600 text-cyan-600' : 'border-transparent text-zinc-500 hover:text-zinc-600'
                                }`}
                        >
                            <Link size={13} /> URL
                        </button>
                    </div>

                    {videoTab === 'file' ? (
                        <div
                            onDrop={handleDrop}
                            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                            onDragLeave={() => setDragOver(false)}
                            onClick={() => fileRef.current?.click()}
                            className={`border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center cursor-pointer transition-all ${dragOver ? 'border-cyan-600 bg-cyan-600/10' : 'border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50'}`}
                        >
                            <input
                                ref={fileRef}
                                type="file"
                                accept="video/*"
                                className="hidden"
                                aria-label="Upload video file"
                                onChange={e => {
                                    const file = e.target.files?.[0]
                                    e.currentTarget.value = ''
                                    if (file) handleFileUpload(file)
                                }}
                            />
                            <Upload size={32} className="mx-auto mb-3 text-zinc-400" />
                            <p className="text-zinc-700 font-medium">Drop video here or click to browse</p>
                            <p className="text-zinc-500 text-xs mt-1">MP4, MOV, AVI, MKV</p>
                            {uploadProgress > 0 && (
                                <div className="mt-4 mx-auto max-w-xs">
                                    <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-yellow-600 rounded-full transition-all duration-300"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-1">{uploadProgress}%</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs text-zinc-500">Download high-quality video from supported platforms (YouTube, Instagram, TikTok or Facebook)</p>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                    {platform ? PLATFORM_ICONS[platform] : <Link size={16} className="text-zinc-400" />}
                                </div>
                                <input
                                    id="video-url"
                                    type="url"
                                    value={videoUrlInput}
                                    onChange={e => setVideoUrlInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleUrlDownload()}
                                    placeholder="https://youtube.com/watch?v=... or Instagram / Facebook / Tiktok"
                                    className="w-full bg-white border border-zinc-300 rounded-xl pl-10 pr-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 transition-all text-sm"
                                />
                            </div>
                            <button type="button"
                                onClick={handleUrlDownload}
                                disabled={videoLoading || !videoUrlInput.trim()}
                                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 w-full text-sm"
                            >
                                {videoLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                {videoLoading ? 'Downloading...' : 'Download'}
                            </button>
                            <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                                <span className="flex items-center gap-1"><SocialIcon network="youtube" style={{ height: 18, width: 18 }} /> YouTube</span>
                                <span className="flex items-center gap-1"><SocialIcon network="instagram" style={{ height: 18, width: 18 }} /> Instagram</span>
                                <span className="flex items-center gap-1"><SocialIcon network="facebook" style={{ height: 18, width: 18 }} /> Facebook</span>
                                <span className="flex items-center gap-1"><SocialIcon network="tiktok" style={{ height: 18, width: 18 }} /> TikTok</span>
                            </div>
                        </div>
                    )}
                </>
            )}

            {videoError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
                    {videoError}
                </div>
            )}
        </div>
    )
}
